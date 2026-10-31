import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CircleDashed,
  Pause,
  Play,
  Plus,
  RotateCcw,
  ShieldCheck,
  StepForward,
  Waypoints,
} from "lucide-react";
import {
  autoStep,
  createRun,
  createTask,
  formatDate,
  getRun,
  getTask,
  interruptRun,
  listTasks,
  resumeRun,
  shortSha,
} from "../api";
import type { AgentRun, AgentTask, Citation, RunState } from "../types";
import { useAuth } from "../auth";
import { errorText } from "../hooks";
import { EvidenceCard, KindBadge, Pill, SectionLabel, Spinner } from "../components/ui";

const STATUS_TONE: Record<string, string> = {
  running: "ok",
  interrupted: "warn",
  paused: "danger",
  complete: "neutral",
};

const ROLE_PRESETS: Record<string, { intro: string; title: string; goal: string }> = {
  security_reviewer: {
    intro: "Security tasks start with findings, then trace the affected code and linked rationale.",
    title: "Review security findings",
    goal: "Find the security findings in this repository, identify the affected files, and explain any linked rationale.",
  },
  developer: {
    intro: "Developer tasks start with the code path, then pull in decisions and surrounding context.",
    title: "Trace code and context",
    goal: "Find the relevant code, explain how it works, and surface the decisions or history that affect a change.",
  },
  maintainer: {
    intro: "Maintainer tasks start with recorded decisions, then check the code they affect.",
    title: "Review decisions and impact",
    goal: "Review the recorded decisions, find the code they affect, and identify what a maintainer should verify.",
  },
  admin: {
    intro: "Admin tasks inspect durable state, source coverage, and the evidence boundary behind answers.",
    title: "Audit repository memory",
    goal: "Inspect the repository memory, its source coverage, and the context persisted for agent runs.",
  },
  reader: {
    intro: "Read-only tasks can be inspected but not created or advanced.",
    title: "Inspect repository memory",
    goal: "Inspect the evidence and handover context without changing repository state.",
  },
};

function toCitation(item: Record<string, unknown>, index: number): Citation {
  const id =
    (item.id as string) ||
    (item.chunk_id as string) ||
    (item.decision_id as string) ||
    (item.finding_id as string) ||
    `result-${index}`;
  const kind = (item.kind as string) || (item.decision_id ? "decision" : item.finding_id ? "finding" : "code");
  return {
    id,
    kind,
    title:
      (item.title as string) ||
      (item.summary as string) ||
      (item.path as string) ||
      (item.rule_id as string) ||
      "retrieved source",
    snippet:
      (item.snippet as string) ||
      (item.rationale as string) ||
      (item.content_excerpt as string) ||
      (item.message as string) ||
      "",
    path: (item.path as string) || null,
    line_start: (item.line_start as number) || null,
    url: (item.url as string) || (item.evidence_url as string) || null,
    label: (item.label as string) || "fact",
  };
}

export function Agent() {
  const { repoId, role } = useAuth();
  const canOperate = role !== "reader" && role !== null;
  const preset = ROLE_PRESETS[role ?? "developer"];

  const [tasks, setTasks] = useState<Array<{ task: AgentTask; run_count: number }>>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [run, setRun] = useState<RunState | null>(null);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [loadingRun, setLoadingRun] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState("");

  const loadTasks = useCallback(async (select?: string) => {
    if (!repoId) return;
    setLoadingTasks(true);
    try {
      const data = await listTasks(repoId);
      setTasks(data.tasks);
      setSelectedTaskId((current) => {
        if (select) return select;
        if (current && data.tasks.some((item) => item.task.task_id === current)) return current;
        return data.tasks[0]?.task.task_id ?? null;
      });
      setError(null);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoadingTasks(false);
    }
  }, [repoId]);

  useEffect(() => {
    setRun(null);
    setSelectedTaskId(null);
    void loadTasks();
  }, [loadTasks]);

  useEffect(() => {
    if (!selectedTaskId) {
      setRun(null);
      return;
    }
    let alive = true;
    (async () => {
      setLoadingRun(true);
      setRun(null);
      try {
        const detail = await getTask(selectedTaskId);
        const runs: AgentRun[] = [...(detail.runs ?? [])].sort((a, b) =>
          String(b.started_at ?? "").localeCompare(String(a.started_at ?? "")),
        );
        if (!alive) return;
        if (runs.length) {
          const state = await getRun(runs[0].run_id);
          if (alive) setRun(state);
        }
        setError(null);
      } catch (err) {
        if (alive) setError(errorText(err));
      } finally {
        if (alive) setLoadingRun(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [selectedTaskId]);

  const selectedTask = tasks.find((item) => item.task.task_id === selectedTaskId)?.task ?? run?.task ?? null;

  const openForm = () => {
    const next = !showForm;
    setShowForm(next);
    if (next && !title.trim() && !goal.trim()) {
      setTitle(preset.title);
      setGoal(preset.goal);
    }
  };

  const onCreateTask = async () => {
    if (!repoId || title.trim().length < 2) return;
    setBusy("create");
    try {
      const data = await createTask(repoId, title.trim(), goal.trim());
      setTitle("");
      setGoal("");
      setShowForm(false);
      await loadTasks(data.task.task_id);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(null);
    }
  };

  const onStartRun = async () => {
    if (!selectedTaskId) return;
    setBusy("start");
    try {
      const state = await createRun(selectedTaskId);
      setRun(state);
      await loadTasks(selectedTaskId);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(null);
    }
  };

  const action = async (kind: "auto" | "interrupt" | "resume") => {
    if (!run) return;
    setBusy(kind);
    try {
      const runId = run.run.run_id;
      const state =
        kind === "auto"
          ? await autoStep(runId)
          : kind === "interrupt"
            ? await interruptRun(runId)
            : await resumeRun(runId);
      setRun(state);
      await loadTasks(selectedTaskId ?? undefined);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(null);
    }
  };

  const results = (run?.results ?? []).map((item, index) => toCitation(item, index));

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">
            {role === "security_reviewer" ? "Security review agent" : "Persistent working state"}
          </p>
          <h1>{role === "security_reviewer" ? "Security review memory" : "Agent memory"}</h1>
          <p className="sub">{preset.intro} On resume, the run revalidates the revision it last saw.</p>
        </div>
        <div className="head-actions">
          <button type="button" className="btn btn-primary" onClick={openForm} disabled={!canOperate}>
            <Plus size={15} />
            New task
          </button>
        </div>
      </header>

      {!canOperate ? (
        <div className="inline-warn">
          <ShieldCheck size={15} /> Your role is read-only. You can inspect tasks and runs but not create or
          advance them.
        </div>
      ) : null}

      {showForm ? (
        <section className="card task-form">
          <SectionLabel>Create a task</SectionLabel>
          <div className="agent-preset-row">
            <button
              type="button"
              className="agent-preset"
              onClick={() => {
                setTitle(preset.title);
                setGoal(preset.goal);
              }}
            >
              <ShieldCheck size={13} />
              Use {role === "security_reviewer" ? "security" : "role"} preset
            </button>
            <span>{preset.goal}</span>
          </div>
          <div className="form-grid">
            <label>
              Title
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Trace the session hashing change"
                maxLength={160}
              />
            </label>
            <label>
              Goal
              <textarea
                value={goal}
                onChange={(event) => setGoal(event.target.value)}
                placeholder="Find why SHA-1 is still used and which decision explains it."
                rows={2}
              />
            </label>
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void onCreateTask()}
              disabled={busy === "create" || title.trim().length < 2}
            >
              {busy === "create" ? <Spinner /> : <Plus size={14} />}
              Create task
            </button>
          </div>
        </section>
      ) : null}

      {error ? <div className="inline-error">{error}</div> : null}

      <div className="agent-grid">
        <div className="stack agent-left">
          <section className="card task-list-card">
          <div className="list-head">
            <SectionLabel>Tasks</SectionLabel>
            <span className="rail-count">{tasks.length}</span>
          </div>
          {loadingTasks ? (
            <div className="state-block">
              <Spinner label="Loading tasks…" />
            </div>
          ) : tasks.length === 0 ? (
            <div className="task-empty">
              <CircleDashed size={20} />
              <p>No tasks yet. Create one to see persistent agent state in action.</p>
            </div>
          ) : (
            <div className="task-rows">
              {tasks.map(({ task, run_count }) => (
                <button
                  key={task.task_id}
                  type="button"
                  className={`task-row${selectedTaskId === task.task_id ? " is-active" : ""}`}
                  onClick={() => setSelectedTaskId(task.task_id)}
                >
                  <span className="task-row-top">
                    <strong>{task.title}</strong>
                    <span className="task-runs">{run_count} run{run_count === 1 ? "" : "s"}</span>
                  </span>
                  <span className="task-goal">{task.goal || "No goal recorded."}</span>
                  <span className="task-row-foot">
                    <span className={`status-dot status-${task.status === "running" ? "ok" : "neutral"}`} />
                    {task.current_step || task.status}
                    <ArrowRight size={12} />
                  </span>
                </button>
              ))}
            </div>
          )}
          <p className="list-foot">
            <Waypoints size={12} /> State persisted in <code>AgentRun</code> nodes
          </p>
          </section>

          <section className="card agent-note-card">
            <SectionLabel>Durable by design</SectionLabel>
            <ul className="agent-note-list">
              <li>
                <CheckCircle2 size={13} />
                <span>
                  <strong>Plan, steps, and context</strong> live on <code>AgentRun</code> nodes, not in
                  process memory.
                </span>
              </li>
              <li>
                <ShieldCheck size={13} />
                <span>
                  <strong>Resume revalidates</strong> the indexed SHA before another tool call is allowed.
                </span>
              </li>
              <li>
                <RotateCcw size={13} />
                <span>
                  <strong>Restart-safe</strong> by construction: reopen the task after any process kill.
                </span>
              </li>
            </ul>
          </section>
        </div>

        <section className="card run-card">
          {loadingRun ? (
            <div className="state-block">
              <Spinner label="Restoring run from the graph…" />
            </div>
          ) : !selectedTask ? (
            <div className="run-empty">
              <Waypoints size={24} />
              <h3>Select or create a task</h3>
              <p>The run timeline, working context, and revalidation result will appear here.</p>
            </div>
          ) : (
            <>
              <header className="run-head">
                <div>
                  <div className="run-title-row">
                    <h2>{selectedTask.title}</h2>
                    {run ? (
                      <Pill tone={STATUS_TONE[run.run.status] ?? "neutral"}>{run.run.status}</Pill>
                    ) : (
                      <Pill tone="neutral">not started</Pill>
                    )}
                  </div>
                  <p className="run-goal">{selectedTask.goal || "No goal recorded for this task."}</p>
                  {run ? (
                    <div className="run-meta">
                      <code>{run.run.run_id}</code>
                      <span>seen {shortSha(run.run.seen_sha)}</span>
                      <span>updated {formatDate(run.run.updated_at)}</span>
                      {run.run.resume_count ? <span>resumed {run.run.resume_count}×</span> : null}
                    </div>
                  ) : null}
                </div>
                <div className="run-actions">
                  {run ? (
                    <>
                      <button
                        type="button"
                        className="btn btn-soft btn-sm"
                        onClick={() => void action("auto")}
                        disabled={!canOperate || busy !== null || run.run.status !== "running"}
                      >
                        <StepForward size={14} />
                        Auto-step
                      </button>
                      {run.run.status === "interrupted" || run.run.status === "paused" ? (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => void action("resume")}
                          disabled={!canOperate || busy !== null}
                        >
                          <Play size={14} />
                          Resume
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => void action("interrupt")}
                          disabled={!canOperate || busy !== null || run.run.status !== "running"}
                        >
                          <Pause size={14} />
                          Interrupt
                        </button>
                      )}
                    </>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => void onStartRun()}
                      disabled={!canOperate || busy !== null}
                    >
                      {busy === "start" ? <Spinner /> : <Play size={14} />}
                      Start run
                    </button>
                  )}
                </div>
              </header>

              {!run ? (
                <div className="run-empty run-empty-inline">
                  <p>
                    This task has no run yet. Starting one pins the indexed SHA and writes the first state to
                    Neo4j.
                  </p>
                </div>
              ) : (
                <>
                  {run.validation ? (
                    <div className={`revalidate ${run.validation.moved ? "is-moved" : "is-ok"}`}>
                      {run.validation.moved ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
                      <div>
                        <strong>
                          {run.validation.moved
                            ? "Repository moved past the revision this run saw"
                            : "Resumed on the same indexed revision"}
                        </strong>
                        <p>
                          seen <code>{shortSha(run.validation.seen_sha)}</code> · current{" "}
                          <code>{shortSha(run.validation.head_sha ?? run.validation.indexed_sha)}</code> ·
                          checked against {run.validation.source}
                        </p>
                      </div>
                      <Pill tone={run.validation.moved ? "danger" : "ok"}>
                        {run.validation.moved ? "paused" : "validated"}
                      </Pill>
                    </div>
                  ) : null}

                  {run.run.resume_note ? <p className="resume-note">{run.run.resume_note}</p> : null}

                  <div className="run-progress">
                    <div className="progress-item">
                      <span className="progress-label">Current step</span>
                      <strong>{run.run.current_step}</strong>
                    </div>
                    <div className="progress-item">
                      <span className="progress-label">Last tool</span>
                      <strong>{run.run.last_tool ?? "none"}</strong>
                    </div>
                    <div className="progress-item">
                      <span className="progress-label">Source refs</span>
                      <strong>{run.run.source_refs.length}</strong>
                    </div>
                    <div className="progress-item">
                      <span className="progress-label">Summary</span>
                      <span className="progress-summary">{run.run.summary}</span>
                    </div>
                  </div>

                  <SectionLabel>Steps</SectionLabel>
                  {run.run.steps.length === 0 ? (
                    <div className="steps-empty">
                      <CircleDashed size={16} />
                      No steps recorded. Auto-step picks a reviewed tool based on the task goal.
                    </div>
                  ) : (
                    <ol className="step-list">
                      {run.run.steps.map((step) => (
                        <li key={step.n} className="step">
                          <span className="step-n">{step.n}</span>
                          <div className="step-body">
                            <div className="step-top">
                              <code>{step.tool}</code>
                              <span>{step.result_count} result{step.result_count === 1 ? "" : "s"}</span>
                              <span className="step-time">{formatDate(step.at)}</span>
                            </div>
                            {Object.keys(step.args ?? {}).length ? (
                              <p className="step-args">
                                {Object.entries(step.args).map(([key, value]) => (
                                  <span key={key}>
                                    <em>{key}</em>={String(value)}
                                  </span>
                                ))}
                              </p>
                            ) : null}
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}

                  <SectionLabel>Working context</SectionLabel>
                  {run.context.length === 0 ? (
                    <p className="muted small">
                      No context linked yet. Each step writes <code>USES_CONTEXT</code> edges back to the
                      sources it used.
                    </p>
                  ) : (
                    <div className="context-grid">
                      {run.context.map((item, index) => (
                        <div className="context-item" key={`${item.node_id ?? item.title}-${index}`}>
                          <KindBadge kind={item.kind} small />
                          <strong>{item.title}</strong>
                          <p>{item.snippet || "Linked source"}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {results.length > 0 ? (
                    <>
                      <SectionLabel>Latest tool results</SectionLabel>
                      <div className="result-grid">
                        {results.map((citation) => (
                          <EvidenceCard key={citation.id} citation={citation} />
                        ))}
                      </div>
                    </>
                  ) : null}

                  <div className="persist-note">
                    <RotateCcw size={14} />
                    <span>
                      This is durable state, not chat history. Restart the API, reopen the task, and the
                      steps above are still here. Resume re-checks the SHA before continuing.
                    </span>
                  </div>
                </>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
