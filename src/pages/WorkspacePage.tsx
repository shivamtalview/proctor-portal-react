import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useAuthStore } from '@/stores/auth';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Modal from '@/components/ui/Modal';
import Card from '@/components/ui/Card';
import Table from '@/components/ui/Table';
import Tabs from '@/components/ui/Tabs';
import { logAudit } from '@/services/audit';
import { PROCTOR_TYPES } from '@/utils/constants';
import { useManagedByOptions } from '@/hooks/useManagedByOptions';
import type { Evaluation, Note, Proctor } from '@/types';

export default function WorkspacePage() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState(0);
  const [evaluationToReview, setEvaluationToReview] = useState<any | null>(null);

  // Vendor role cannot access workspace
  if (user?.role === 'vendor') {
    return (
      <Card className="p-6">
        <div className="bg-warning/10 border border-warning/30 text-warning rounded-lg p-4">
          Workspace is not available for vendor role.
        </div>
      </Card>
    );
  }

  const title = user?.role === 'admin' ? 'Admin Workspace' : `${user?.name} — Workspace`;

  return (
    <div>
      {/* Page Header */}
      <div className="mb-6">
        <h2 className="text-[20px] font-bold text-text">{title}</h2>
        <p className="text-[13px] text-text2 mt-0.5">Today's tasks and personal notes</p>
      </div>

      {/* Tabs */}
      <Tabs
        tabs={[
          { id: 0, label: '📅 Upcoming Tasks' },
          { id: 1, label: '📋 Scheduled Events' },
          { id: 2, label: '📌 My Notes' },
        ]}
        activeTab={activeTab}
        onChange={(id) => setActiveTab(id as number)}
        variant="reserved"
      />

      {/* Tab Content */}
      {activeTab === 0 && (
        <UpcomingTasksTab onEvaluate={(task) => setEvaluationToReview(task)} />
      )}
      {activeTab === 1 && (
        <ScheduledEventsTab onEvaluate={(task) => setEvaluationToReview(task)} />
      )}
      {activeTab === 2 && <NotesTab />}

      {evaluationToReview && (
        <EvaluationResultModal
          evaluation={evaluationToReview}
          onClose={() => setEvaluationToReview(null)}
          onSuccess={() => setEvaluationToReview(null)}
        />
      )}
    </div>
  );
}

// ============================================
// TAB 1: Upcoming Tasks
// ============================================
function UpcomingTasksTab({
  onEvaluate,
}: {
  onEvaluate: (task: any) => void;
}) {
  const { user } = useAuthStore();
  const [dateFilter, setDateFilter] = useState('');

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['workspace-tasks', user?.username, dateFilter],
    queryFn: async () => {
      // Admin sees ALL panels, coordinator sees own
      let query = supabase
        .from('proctor_evaluations')
        .select('*')
        .is('result', null)
        .order('scheduled_date', { ascending: true });

      if (user?.role !== 'admin') {
        query = query.eq('panel_user', user?.username);
      }

      const { data, error } = await query;
      if (error) throw error;

      let filtered = data as Evaluation[];
      if (dateFilter) {
        filtered = filtered.filter(t => t.scheduled_date === dateFilter);
      }

      return filtered;
    },
  });

  // Fetch proctors for task cards
  const { data: proctors = [] } = useQuery({
    queryKey: ['all-proctors'],
    queryFn: async () => {
      const { data, error } = await supabase.from('proctors').select('*');
      if (error) throw error;
      return data as Proctor[];
    },
  });

  const today = new Date().toISOString().slice(0, 10);
  const overdueRows = tasks.filter(t => t.scheduled_date < today);
  const todayRows = tasks.filter(t => t.scheduled_date === today);
  const upcomingRows = tasks.filter(t => t.scheduled_date > today);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-text2">Loading tasks...</div>
      </div>
    );
  }

  return (
    <div>
      {/* Date Filter */}
      <div className="flex gap-2 items-center mb-4 flex-wrap">
        <label className="text-[12px] text-text2">Filter by date:</label>
        <Input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="w-auto"
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setDateFilter('')}
        >
          Clear
        </Button>
      </div>

      {/* Tasks */}
      {tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <div className="text-5xl">🎉</div>
          <h3 className="text-text font-semibold">No upcoming tasks</h3>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Overdue */}
          {overdueRows.length > 0 && (
            <div>
              <div className="text-[12px] font-bold text-danger uppercase tracking-wider mb-2">
                ⚠️ Overdue
              </div>
              <div className="space-y-2">
                {overdueRows.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    proctor={proctors.find(p => p.id === task.proctor_id)}
                    when="overdue"
                    showPanel={user?.role === 'admin'}
                    onEvaluate={(item) => onEvaluate({ ...item, proctor: proctors.find((p) => p.id === item.proctor_id) })}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Today */}
          {todayRows.length > 0 && (
            <div>
              <div className="text-[12px] font-bold text-accent uppercase tracking-wider mb-2">
                Today
              </div>
              <div className="space-y-2">
                {todayRows.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    proctor={proctors.find(p => p.id === task.proctor_id)}
                    when="today"
                    showPanel={user?.role === 'admin'}
                    onEvaluate={(item) => onEvaluate({ ...item, proctor: proctors.find((p) => p.id === item.proctor_id) })}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Upcoming */}
          {upcomingRows.length > 0 && (
            <div>
              <div className="text-[12px] font-bold text-text3 uppercase tracking-wider mb-2">
                Upcoming
              </div>
              <div className="space-y-2">
                {upcomingRows.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    proctor={proctors.find(p => p.id === task.proctor_id)}
                    when="upcoming"
                    showPanel={user?.role === 'admin'}
                    onEvaluate={(item) => onEvaluate({ ...item, proctor: proctors.find((p) => p.id === item.proctor_id) })}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface TaskCardProps {
  task: Evaluation;
  proctor?: Proctor;
  when: 'overdue' | 'today' | 'upcoming';
  showPanel: boolean;
  onEvaluate: (task: Evaluation & { proctor?: Proctor }) => void;
}

function TaskCard({ task, proctor, when, showPanel, onEvaluate }: TaskCardProps) {
  const borderColor =
    when === 'overdue'
      ? 'border-l-danger'
      : when === 'today'
      ? 'border-l-accent'
      : 'border-l-border';

  const canEvaluate = new Date(task.scheduled_date) <= new Date();

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <Card
      className={`p-4 flex items-center gap-3 border-l-[3px] ${borderColor}`}
    >
      <span
        className={`text-[11px] font-bold px-2 py-1 rounded ${
          task.eval_type === 'demo'
            ? 'bg-purple-500/15 text-purple-400'
            : 'bg-blue-500/15 text-blue-400'
        }`}
      >
        {task.eval_type}
      </span>

      <div className="flex-1">
        <div className="text-[13px] font-bold text-text">{proctor?.name || 'Unknown'}</div>
        <div className="text-[11px] text-text3">
          {showPanel && <span className="text-accent">Panel: {task.panel_user} · </span>}
          {task.score_out_of && <span>Score out of: {task.score_out_of} · </span>}
          {proctor?.vendor || proctor?.managed_by} · {proctor?.ptype} · Attempt #{task.attempt_number}
          {task.scheduled_time && ` · ${task.scheduled_time}`}
        </div>
      </div>

      <div className={`text-[12px] ${when === 'overdue' ? 'text-danger' : 'text-text3'}`}>
        {formatDate(task.scheduled_date)}
      </div>

      {canEvaluate ? (
        <Button variant="primary" size="sm" onClick={() => onEvaluate({ ...task, proctor })}>
          📝 Evaluate
        </Button>
      ) : (
        <Button variant="ghost" size="sm" disabled>
          🔒 {formatDate(task.scheduled_date)}
        </Button>
      )}
    </Card>
  );
}

// Helper function to check if evaluation can be done now (30 min before scheduled time)
function canEvaluateNow(scheduledDate: string, scheduledTime?: string): boolean {
  const now = new Date();
  const schedDate = new Date(scheduledDate);
  
  if (scheduledTime) {
    // Parse time like "10:00" or "14:30"
    const [hours, minutes] = scheduledTime.split(':').map(Number);
    schedDate.setHours(hours, minutes, 0, 0);
    // Allow evaluation 30 minutes before scheduled time
    const unlockTime = new Date(schedDate.getTime() - 30 * 60 * 1000);
    return now >= unlockTime;
  } else {
    // If no time specified, allow on or after the scheduled date
    return now >= schedDate;
  }
}

// ============================================
// TAB 2: Scheduled Events
// ============================================
function ScheduledEventsTab({
  onEvaluate,
}: {
  onEvaluate: (evaluation: any) => void;
}) {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [dateFilter, setDateFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [vendorFilter, setVendorFilter] = useState('');
  const [ptypeFilter, setPtypeFilter] = useState('');
  const [editingEval, setEditingEval] = useState<any>(null);
  const { data: managedByOptions = [] } = useManagedByOptions();

  const { data: scheduled = [], isLoading } = useQuery({
    queryKey: ['scheduled-events', user?.username],
    queryFn: async () => {
      // Only fetch evaluations where result is null (pending/scheduled)
      let query = supabase
        .from('proctor_evaluations')
        .select('*')
        .is('result', null)
        .order('scheduled_date', { ascending: true }); // Ascending order like HTML

      if (user?.role !== 'admin') {
        query = query.eq('panel_user', user?.username);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Fetch all proctors for filtering
  const { data: allProctors = [] } = useQuery({
    queryKey: ['all-proctors'],
    queryFn: async () => {
      const { data, error } = await supabase.from('proctors').select('*');
      if (error) throw error;
      return data as Proctor[];
    },
  });

  const filteredData = (scheduled || []).filter((item: any) => {
    const proctor = allProctors.find(p => p.id === item.proctor_id);
    if (dateFilter && item.scheduled_date !== dateFilter) return false;
    if (typeFilter && item.eval_type !== typeFilter) return false;
    if (vendorFilter && (proctor?.vendor || proctor?.managed_by) !== vendorFilter) return false;
    if (ptypeFilter && proctor?.ptype !== ptypeFilter) return false;
    return true;
  }).map((item: any) => ({
    ...item,
    proctor: allProctors.find(p => p.id === item.proctor_id)
  }));

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div>
      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap items-center">
        <Input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="w-auto"
        />
        <Select
          options={[
            { value: '', label: 'All Types' },
            { value: 'demo', label: 'Demo' },
            { value: 'assessment', label: 'Assessment' },
          ]}
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="min-w-[140px]"
        />
        <Select
            options={[
              { value: '', label: 'All Managed By' },
              ...managedByOptions,
            ]}
          value={vendorFilter}
          onChange={(e) => setVendorFilter(e.target.value)}
          className="min-w-[160px]"
        />
        <Select
          options={[
            { value: '', label: 'All Proctor Types' },
            ...PROCTOR_TYPES.map((t) => ({ value: t, label: t })),
          ]}
          value={ptypeFilter}
          onChange={(e) => setPtypeFilter(e.target.value)}
          className="min-w-[160px]"
        />
        <Button variant="ghost" size="sm" onClick={() => setDateFilter('')}>
          Clear Date
        </Button>
      </div>

      {/* Table */}
      <Table
        data={filteredData}
        isLoading={isLoading}
        emptyMessage="No scheduled events"
        columns={[
          {
            header: 'Proctor',
            accessor: (item: any) => (
              <>
                <div className="text-[13px] text-text">{item.proctor?.name || 'Unknown'}</div>
                <div className="text-[11px] text-text3">
                  {item.proctor?.email || ''} · {item.proctor?.vendor || item.proctor?.managed_by}
                </div>
              </>
            ),
          },
          {
            header: 'Type',
            accessor: (item: any) => (
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                item.eval_type === 'demo'
                  ? 'bg-purple-500/15 text-purple-400'
                  : 'bg-blue-500/15 text-blue-400'
              }`}>
                {item.eval_type}
              </span>
            ),
          },
          {
            header: 'Panel',
            accessor: (item: any) => item.panel_user,
            className: 'text-[12px] text-text2',
          },
          {
            header: 'Scheduled Date & Time',
            accessor: (item: any) => (
              <>
                {formatDate(item.scheduled_date)}
                {item.scheduled_time && ` · ${item.scheduled_time}`}
              </>
            ),
            className: 'text-[12px] text-text2',
          },
          {
            header: 'Attempt',
            accessor: (item: any) => (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-surface2 text-text">
                #{item.attempt_number}
              </span>
            ),
          },
          {
            header: 'Status',
            accessor: () => (
              <span className="text-[11px] font-bold text-accent">
                📅 Scheduled
              </span>
            ),
          },
          {
            header: 'Score Out Of',
            accessor: (item: any) => item.score_out_of || '—',
            className: 'text-[11px] font-mono text-text2',
          },
          {
            header: 'Actions',
            accessor: (item: any) => (
              <div className="flex gap-1">
                {canEvaluateNow(item.scheduled_date, item.scheduled_time) ? (
                  <Button variant="primary" size="sm" onClick={() => onEvaluate(item)}>
                    📝 Evaluate
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled
                    title={`Unlocks 30min before: ${formatDate(item.scheduled_date)}${item.scheduled_time ? ' ' + item.scheduled_time : ''}`}
                  >
                    🔒 {formatDate(item.scheduled_date)}
                  </Button>
                )}
                {user?.role === 'admin' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingEval(item)}
                  >
                    ✏️ Edit
                  </Button>
                )}
              </div>
            ),
          },
        ]}
      />

      {/* Edit/Reschedule Modal */}
      {editingEval && (
        <RescheduleModal
          evaluation={editingEval}
          onClose={() => setEditingEval(null)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['scheduled-events'] });
            setEditingEval(null);
          }}
        />
      )}
    </div>
  );
}

function EvaluationResultModal({
  evaluation,
  onClose,
  onSuccess,
}: {
  evaluation: any;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const queryClient = useQueryClient();
  const [result, setResult] = useState(evaluation.result || '');
  const [score, setScore] = useState(
    evaluation.score_obtained != null ? String(evaluation.score_obtained) : ''
  );
  const [comment, setComment] = useState(evaluation.comment || '');
  const [commentOther, setCommentOther] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: proctor } = useQuery({
    queryKey: ['workspace-eval-proctor', evaluation.proctor_id],
    queryFn: async () => {
      if (evaluation.proctor) return evaluation.proctor;
      const { data, error } = await supabase
        .from('proctors')
        .select('id, name, vendor, managed_by, email')
        .eq('id', evaluation.proctor_id)
        .single();

      if (error) throw error;
      return data;
    },
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const newErrors: Record<string, string> = {};

      if (!result) newErrors.result = 'Result is required';
      if (!score || isNaN(Number(score))) newErrors.score = 'Score is required';
      if (['Reattempt', 'Reschedule'].includes(result) && !comment && !commentOther) {
        newErrors.comment = 'Comment is required for ' + result;
      }

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        throw new Error('Validation failed');
      }

      const now = new Date().toISOString();
      const certDate = result === 'Pass' ? now.slice(0, 10) : null;
      const finalComment = comment === 'Other' ? commentOther : [comment, commentOther].filter(Boolean).join(' — ');

      const { error: evalError } = await supabase
        .from('proctor_evaluations')
        .update({
          result,
          score_obtained: Number(score),
          comment: finalComment,
          certified_date: certDate,
        })
        .eq('id', evaluation.id);

      if (evalError) throw evalError;

      const readyField = evaluation.eval_type === 'demo' ? 'demo_ready' : 'assessment_ready';
      const evalField = evaluation.eval_type === 'demo' ? 'demo_eval' : 'assessment';
      const readyVal =
        result === 'Pass'
          ? 'pass'
          : result === 'No Show'
            ? 'noshow'
            : result === 'Reschedule'
              ? 'reschedule'
              : 'reattempt';
      const evalVal = result === 'Pass' ? 'Pass' : 'Pending';

      const { error: proctorError } = await supabase
        .from('proctors')
        .update({
          [readyField]: readyVal,
          [evalField]: evalVal,
          upd: now,
        })
        .eq('id', evaluation.proctor_id);

      if (proctorError) throw proctorError;

      await logAudit({
        action: evaluation.result ? 'Eval Override' : 'Eval Result',
        target: proctor?.name || evaluation.proctor_id,
        detail: `${evaluation.eval_type} Attempt #${evaluation.attempt_number}: ${result}${finalComment ? ` — ${finalComment}` : ''}${evaluation.result ? ` [overrides: ${evaluation.result}]` : ''} · by ${useAuthStore.getState().user?.username || useAuthStore.getState().user?.name || 'system'}`,
        user: useAuthStore.getState().user?.username || useAuthStore.getState().user?.name || null,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['workspace-tasks'] });
      await queryClient.invalidateQueries({ queryKey: ['scheduled-events'] });
      await queryClient.invalidateQueries({ queryKey: ['evaluations-results'] });
      onSuccess();
      alert('Result saved');
    },
    onError: (error: any) => {
      if (error.message !== 'Validation failed') {
        alert('Save failed: ' + error.message);
      }
    },
  });

  const optionsByResult: Record<string, string[]> = {
    Pass: ['Strong overall performance', 'Excellent communication', 'Met all criteria', 'Good technical knowledge'],
    Reattempt: ['Needs more preparation', 'Communication issues', 'Incomplete responses', 'Technical knowledge gaps', 'Nervousness/confidence issues'],
    'No Show': ['Proctor did not show up', 'Connection issues reported', 'Notified late cancellation', 'No prior notice'],
    Reschedule: ['Rescheduled by proctor', 'Rescheduled by panel', 'Technical issues during session', 'Emergency situation'],
  };

  const commentOptions = result ? [...(optionsByResult[result] || []), 'Other'] : [];

  const finalCommentValue = comment === 'Other' ? commentOther : comment;

  return (
    <Modal isOpen={true} onClose={onClose} title={`${evaluation.result ? 'Override Result' : 'Evaluate'} — ${evaluation.eval_type}`}>
      <div className="space-y-4">
        <div className="text-xs text-text2">
          <div>
            <strong>{proctor?.name || 'Unknown'}</strong> ({proctor?.vendor || proctor?.managed_by || '—'}) · {evaluation.eval_type} · Panel: {evaluation.panel_user} · Scheduled: {formatDateTime(evaluation.scheduled_date, evaluation.scheduled_time)} · Attempt #{evaluation.attempt_number}
            {evaluation.score_out_of && ` · Score out of: ${evaluation.score_out_of}`}
          </div>
          {evaluation.result && (
            <div className="bg-warning/10 border border-warning/30 rounded-lg p-2 mt-2">
              ⚠️ Result already submitted as <strong>{evaluation.result}</strong>. Admin override will be logged.
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-text mb-1">
              Result <span className="text-danger">*</span>
            </label>
            <Select
              options={[
                { value: '', label: 'Select result...' },
                { value: 'Pass', label: 'Pass' },
                { value: 'Reattempt', label: 'Reattempt' },
                { value: 'No Show', label: 'No Show' },
                { value: 'Reschedule', label: 'Reschedule' },
              ]}
              value={result}
              onChange={(e) => {
                setResult(e.target.value);
                setComment('');
                setCommentOther('');
                setErrors({ ...errors, result: '' });
              }}
            />
            {errors.result && <div className="text-danger text-xs mt-1">{errors.result}</div>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-text mb-1">
              Score {evaluation.score_out_of && <span className="text-text3">(out of {evaluation.score_out_of})</span>} <span className="text-danger">*</span>
            </label>
            <Input
              type="number"
              min={0}
              max={evaluation.score_out_of || undefined}
              value={score}
              onChange={(e) => {
                setScore(e.target.value);
                setErrors({ ...errors, score: '' });
              }}
              placeholder="Enter score..."
            />
            {errors.score && <div className="text-danger text-xs mt-1">{errors.score}</div>}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-text mb-1">
            Comment {['Reattempt', 'Reschedule'].includes(result) && <span className="text-danger">*</span>}
          </label>
          <Select
            options={[
              { value: '', label: 'Select reason...' },
              ...commentOptions.map((c) => ({ value: c, label: c })),
            ]}
            value={comment}
            onChange={(e) => {
              setComment(e.target.value);
              setErrors({ ...errors, comment: '' });
            }}
          />
          {comment === 'Other' && (
            <textarea
              value={commentOther}
              onChange={(e) => setCommentOther(e.target.value)}
              placeholder="Enter reason..."
              rows={3}
              className="w-full mt-2 px-3 py-2 bg-surface2 border border-border rounded-lg text-[13px] text-text outline-none focus:border-accent resize-none"
            />
          )}
          {finalCommentValue && (
            <div className="text-[11px] text-text3 mt-1">Selected: {finalCommentValue}</div>
          )}
          {errors.comment && <div className="text-danger text-xs mt-1">{errors.comment}</div>}
        </div>

        <div className="flex gap-2 justify-end pt-4 border-t border-border">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => submitMutation.mutate()}
            disabled={submitMutation.isPending}
          >
            💾 Submit Evaluation
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function formatDateTime(date?: string, time?: string) {
  if (!date) return '—';
  const d = new Date(date);
  const dateStr = d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
  return time ? `${dateStr} ${time}` : dateStr;
}

// ============================================
// Reschedule/Edit Event Modal
// ============================================
interface RescheduleModalProps {
  evaluation: any;
  onClose: () => void;
  onSuccess: () => void;
}

function RescheduleModal({ evaluation, onClose, onSuccess }: RescheduleModalProps) {
  const [panelUser, setPanelUser] = useState(evaluation.panel_user || '');
  const [scheduledDate, setScheduledDate] = useState(evaluation.scheduled_date || '');
  const [scheduledTime, setScheduledTime] = useState(evaluation.scheduled_time || '');
  const [scoreOutOf, setScoreOutOf] = useState(evaluation.score_out_of?.toString() || '');

  // Fetch panel users (coordinators with role='talview')
  const { data: panelUsers = [] } = useQuery({
    queryKey: ['panel-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('username')
        .eq('role', 'talview');
      
      if (error) throw error;
      return data.map((u: any) => u.username);
    },
  });

  // Fetch proctor name for modal title
  const { data: proctor } = useQuery({
    queryKey: ['proctor', evaluation.proctor_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proctors')
        .select('name')
        .eq('id', evaluation.proctor_id)
        .single();
      
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!scheduledDate) throw new Error('Date is required');
      
      const today = new Date().toISOString().slice(0, 10);
      if (scheduledDate < today) {
        throw new Error('Cannot reschedule to a past date');
      }

      const updates: any = {
        scheduled_date: scheduledDate,
      };
      
      if (panelUser) updates.panel_user = panelUser;
      if (scheduledTime) updates.scheduled_time = scheduledTime;
      if (scoreOutOf) updates.score_out_of = parseFloat(scoreOutOf);

      const { error } = await supabase
        .from('proctor_evaluations')
        .update(updates)
        .eq('id', evaluation.id);

      if (error) throw error;

      await logAudit({
        action: 'Assessment Scheduled',
        target: proctor?.name || evaluation.proctor_id,
        detail: `Rescheduled by ${useAuthStore.getState().user?.username || useAuthStore.getState().user?.name || 'system'} · ${scheduledDate}${scheduledTime ? ` ${scheduledTime}` : ''}`,
        user: useAuthStore.getState().user?.username || useAuthStore.getState().user?.name || null,
      });
    },
    onSuccess: () => {
      alert('Event updated successfully');
      onSuccess();
    },
    onError: (error: any) => {
      alert('Failed: ' + error.message);
    },
  });

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={`Edit ${evaluation.eval_type} — ${proctor?.name || 'Unknown'}`}
    >
      <div className="space-y-4">
        <div>
          <label className="block text-[12px] font-semibold text-text mb-1">
            Panel (Coordinator)
          </label>
          <Select
            options={[
              { value: '', label: 'Select...' },
              ...panelUsers.map((u: string) => ({ value: u, label: u })),
            ]}
            value={panelUser}
            onChange={(e) => setPanelUser(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-[12px] font-semibold text-text mb-1">
            Scheduled Date <span className="text-danger">*</span>
          </label>
          <Input
            type="date"
            value={scheduledDate}
            onChange={(e) => setScheduledDate(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-[12px] font-semibold text-text mb-1">
            Scheduled Time
          </label>
          <Input
            type="time"
            value={scheduledTime}
            onChange={(e) => setScheduledTime(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-[12px] font-semibold text-text mb-1">
            Score Out Of
          </label>
          <Input
            type="number"
            value={scoreOutOf}
            onChange={(e) => setScoreOutOf(e.target.value)}
            placeholder="e.g. 100"
            min="1"
          />
        </div>

        <div className="flex gap-2 justify-end pt-4 border-t border-border">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
          >
            💾 Save Changes
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ============================================
// TAB 3: My Notes
// ============================================
function NotesTab() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ['user-notes', user?.username],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_notes')
        .select('*')
        .eq('username', user?.username)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Note[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('user_notes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-notes'] });
    },
  });

  const toggleDoneMutation = useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) => {
      const { error } = await supabase.from('user_notes').update({ done }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-notes'] });
    },
  });

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="text-[13px] text-text2">Your private notes — only visible to you</div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => {
            setEditingNote(null);
            setShowModal(true);
          }}
        >
          + Add Note
        </Button>
      </div>

      {/* Notes Grid */}
      {isLoading ? (
        <div className="text-center py-12 text-text2">Loading notes...</div>
      ) : notes.length === 0 ? (
        <div className="text-center py-12 text-text3">
          No notes yet. Click + Add Note to create one.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {notes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              onEdit={() => {
                setEditingNote(note);
                setShowModal(true);
              }}
              onDelete={() => deleteMutation.mutate(note.id)}
              onToggleDone={() =>
                toggleDoneMutation.mutate({ id: note.id, done: !note.done })
              }
            />
          ))}
        </div>
      )}

      {/* Note Modal */}
      {showModal && (
        <NoteModal
          note={editingNote}
          onClose={() => {
            setShowModal(false);
            setEditingNote(null);
          }}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['user-notes'] });
            setShowModal(false);
            setEditingNote(null);
          }}
        />
      )}
    </div>
  );
}

interface NoteCardProps {
  note: Note;
  onEdit: () => void;
  onDelete: () => void;
  onToggleDone: () => void;
}

function NoteCard({ note, onEdit, onDelete, onToggleDone }: NoteCardProps) {
  const colorClasses = {
    red: 'bg-red-500/10 border-red-500/30',
    yellow: 'bg-yellow-500/10 border-yellow-500/30',
    green: 'bg-green-500/10 border-green-500/30',
    blue: 'bg-blue-500/10 border-blue-500/30',
  };

  const noteColor = note.colour || note.color || 'yellow';

  return (
    <div
      className={`border rounded-lg p-4 ${colorClasses[noteColor as keyof typeof colorClasses]} ${
        note.done ? 'opacity-60' : ''
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <h3
          className={`text-[14px] font-bold text-text ${
            note.done ? 'line-through' : ''
          }`}
        >
          {note.title}
        </h3>
        <input
          type="checkbox"
          checked={note.done}
          onChange={onToggleDone}
          className="w-4 h-4 accent-accent cursor-pointer"
        />
      </div>
      <p className="text-[12px] text-text2 mb-3 whitespace-pre-wrap">{note.body}</p>
      {note.due_date && (
        <div className="text-[11px] text-text3 mb-3">
          📅 Due: {new Date(note.due_date).toLocaleDateString('en-IN')}
        </div>
      )}
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" onClick={onEdit}>
          ✏️ Edit
        </Button>
        <Button variant="ghost" size="sm" onClick={onDelete}>
          🗑️ Delete
        </Button>
      </div>
    </div>
  );
}

interface NoteModalProps {
  note: Note | null;
  onClose: () => void;
  onSuccess: () => void;
}

function NoteModal({ note, onClose, onSuccess }: NoteModalProps) {
  const { user } = useAuthStore();
  const [title, setTitle] = useState(note?.title || '');
  const [body, setBody] = useState(note?.body || '');
  const [color, setColor] = useState<'red' | 'yellow' | 'green' | 'blue'>(
    note?.colour || note?.color || 'yellow'
  );
  const [dueDate, setDueDate] = useState(note?.due_date || '');

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error('Title is required');

      const noteData = {
        title: title.trim(),
        body: body.trim(),
        colour: color, // Database uses 'colour' not 'color'
        due_date: dueDate || null,
        done: note?.done || false,
        username: user?.username,
      };

      if (note) {
        const { error } = await supabase
          .from('user_notes')
          .update(noteData)
          .eq('id', note.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('user_notes').insert(noteData);
        if (error) throw error;
      }
    },
    onSuccess,
    onError: (error: any) => {
      alert('Error: ' + error.message);
    },
  });

  return (
    <Modal isOpen={true} onClose={onClose} title={note ? 'Edit Note' : 'Add Note'}>
      <div className="space-y-4">
        <div>
          <label className="block text-[12px] font-semibold text-text mb-1">
            Title *
          </label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Note title"
          />
        </div>

        <div>
          <label className="block text-[12px] font-semibold text-text mb-1">Body</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Note content..."
            rows={4}
            className="w-full px-3 py-2 bg-surface2 border border-border rounded-lg text-[13px] text-text outline-none focus:border-accent resize-none"
          />
        </div>

        <div>
          <label className="block text-[12px] font-semibold text-text mb-1">Color</label>
          <div className="flex gap-2">
            {(['red', 'yellow', 'green', 'blue'] as const).map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-10 h-10 rounded border-2 ${
                  color === c ? 'border-text' : 'border-transparent'
                } ${
                  c === 'red'
                    ? 'bg-red-500/30'
                    : c === 'yellow'
                    ? 'bg-yellow-500/30'
                    : c === 'green'
                    ? 'bg-green-500/30'
                    : 'bg-blue-500/30'
                }`}
              />
            ))}
          </div>
        </div>

        <div>
          <label className="block text-[12px] font-semibold text-text mb-1">
            Due Date (Optional)
          </label>
          <Input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>

        <div className="flex gap-2 justify-end pt-4 border-t border-border">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
          >
            💾 Save Note
          </Button>
        </div>
      </div>
    </Modal>
  );
}
