import { supabase } from '../lib/supabase';
import type { ActivityEvent, EvidenceCard, EvidenceResponse, ForecastRevision, LiquidityObservation, MissionAssignment, MissionCheckpoint, MissionDebrief, PendingWorkspaceInvite, PersonalForecast, ResearchMission, ResearchQuestion, ResearchWorkspace, SharedThesis, SharedThesisResponse, WorkspaceMember } from '../types/domain';

export type CollaborationSlice = {
  researchWorkspace?: ResearchWorkspace;
  workspaceMembers: WorkspaceMember[];
  pendingWorkspaceInvites: PendingWorkspaceInvite[];
  evidence: EvidenceCard[];
  evidenceResponses: EvidenceResponse[];
  sharedTheses: SharedThesis[];
  sharedThesisResponses: SharedThesisResponse[];
  activity: ActivityEvent[];
  missions: ResearchMission[];
  missionAssignments: MissionAssignment[];
  researchQuestions: ResearchQuestion[];
  liquidityObservations: LiquidityObservation[];
  missionCheckpoints: MissionCheckpoint[];
  forecasts: PersonalForecast[];
  forecastRevisions: ForecastRevision[];
  debriefs: MissionDebrief[];
};

export const emptyCollaboration = (): CollaborationSlice => ({
  workspaceMembers: [], pendingWorkspaceInvites: [], evidence: [], evidenceResponses: [], sharedTheses: [], sharedThesisResponses: [], activity: [], missions: [], missionAssignments: [], researchQuestions: [], liquidityObservations: [], missionCheckpoints: [], forecasts: [], forecastRevisions: [], debriefs: [],
});

const row = (value: unknown) => value as Record<string, unknown>;
const text = (value: unknown) => typeof value === 'string' ? value : '';
const optional = (value: unknown) => text(value) || undefined;
const number = (value: unknown) => value === null || value === undefined ? undefined : Number(value);
const rows = (value: unknown) => Array.isArray(value) ? value.map(row) : [];
const unavailable = (error: { code?: string; message?: string } | null) => Boolean(error && (error.code === '42P01' || error.code === 'PGRST202' || error.code === 'PGRST205' || /does not exist|schema cache/i.test(error.message || '')));

export async function loadCollaboration(userId: string): Promise<CollaborationSlice> {
  if (!supabase || !userId) return emptyCollaboration();
  const workspaces = await supabase.from('workspaces').select('id,name,created_by,updated_at').is('archived_at', null).order('created_at');
  if (unavailable(workspaces.error)) return emptyCollaboration();
  if (workspaces.error) throw new Error(workspaces.error.message);

  const pendingResult = await supabase.rpc('list_pending_workspace_invites');
  if (pendingResult.error && !unavailable(pendingResult.error)) throw new Error(pendingResult.error.message);
  const pendingWorkspaceInvites: PendingWorkspaceInvite[] = rows(pendingResult.data).map((item) => ({
    id: text(item.invite_id), workspaceId: text(item.workspace_id), workspaceName: text(item.workspace_name), invitedByName: text(item.invited_by_name), expiresAt: text(item.expires_at),
  }));
  const selected = rows(workspaces.data)[0];
  if (!selected) return { ...emptyCollaboration(), pendingWorkspaceInvites };
  const workspaceId = text(selected.id);
  const researchWorkspace: ResearchWorkspace = { id: workspaceId, name: text(selected.name), createdBy: text(selected.created_by), updatedAt: text(selected.updated_at) };

  const [membersResult, evidenceResult, responsesResult, thesesResult, thesisResponsesResult, activityResult, missionsResult, assignmentsResult, questionsResult, liquidityResult, checkpointsResult, forecastsResult, revisionsResult, debriefsResult] = await Promise.all([
    supabase.rpc('list_workspace_members', { p_workspace_id: workspaceId }),
    supabase.from('evidence_cards').select('id,workspace_id,catalyst_id,mission_id,author_id,evidence_type,title,summary,source_label,source_url,observed_at,confidence,affected_assumption,verification_status,last_verified_at,created_at,updated_at').eq('workspace_id', workspaceId).is('deleted_at', null).order('created_at', { ascending: false }),
    supabase.from('evidence_responses').select('id,evidence_id,workspace_id,author_id,response_type,body,source_url,created_at').eq('workspace_id', workspaceId).is('deleted_at', null).order('created_at'),
    supabase.from('shared_theses').select('id,workspace_id,author_id,catalyst_id,ticker,strategy,bias,thesis_summary,expected_move_summary,confidence,created_at,updated_at').eq('workspace_id', workspaceId).is('archived_at', null).order('created_at', { ascending: false }),
    supabase.from('shared_thesis_responses').select('id,shared_thesis_id,workspace_id,author_id,response_type,body,created_at').eq('workspace_id', workspaceId).is('deleted_at', null).order('created_at'),
    supabase.from('activity_events').select('id,workspace_id,actor_id,event_type,object_type,object_id,summary,created_at').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(50),
    supabase.from('research_missions').select('id,workspace_id,catalyst_id,title,status,completed_decision,created_by,created_at,updated_at,completed_at').eq('workspace_id', workspaceId).neq('status', 'archived').order('updated_at', { ascending: false }),
    supabase.from('mission_assignments').select('id,mission_id,workspace_id,assignee_id,created_by,role,task,status,completed_at').eq('workspace_id', workspaceId).order('created_at'),
    supabase.from('research_questions').select('id,mission_id,workspace_id,created_by,assigned_to,question,resolution,status,created_at').eq('workspace_id', workspaceId).order('created_at'),
    supabase.from('options_liquidity_observations').select('id,mission_id,workspace_id,created_by,ticker,observation,source_label,observed_at,last_verified_at,created_at').eq('workspace_id', workspaceId).is('deleted_at', null).order('observed_at', { ascending: false }),
    supabase.from('mission_checkpoints').select('mission_id,workspace_id,checkpoint_type,status,completed_by,completed_at,note').eq('workspace_id', workspaceId),
    supabase.from('personal_forecasts').select('id,user_id,workspace_id,catalyst_id,mission_id,expected_result,market_direction,expected_magnitude,magnitude_unit,confidence,preferred_ticker,intended_strategy,trade_decision,visibility,revision,locked_at,created_at,updated_at').eq('workspace_id', workspaceId).order('updated_at', { ascending: false }),
    supabase.from('forecast_revisions').select('id,forecast_id,user_id,workspace_id,revision,snapshot_type,visibility_at_revision,snapshot,revision_reason,created_at,locked_at').eq('workspace_id', workspaceId).order('created_at', { ascending: false }),
    supabase.from('mission_debriefs').select('id,workspace_id,mission_id,catalyst_id,author_id,actual_result,actual_direction,actual_magnitude,market_reaction,key_driver,what_worked,what_missed,unexpected_factor,shared_summary,visibility,created_at,updated_at').eq('workspace_id', workspaceId).order('created_at', { ascending: false }),
  ]);
  const results = [membersResult, evidenceResult, responsesResult, thesesResult, thesisResponsesResult, activityResult, missionsResult, assignmentsResult, questionsResult, liquidityResult, checkpointsResult, forecastsResult, revisionsResult, debriefsResult];
  const failure = results.find((result) => result.error)?.error;
  if (failure) throw new Error(failure.message);

  const workspaceMembers: WorkspaceMember[] = rows(membersResult.data).map((item) => ({ workspaceId: text(item.workspace_id), userId: text(item.user_id), displayName: text(item.display_name), initials: text(item.initials), workspaceRole: item.workspace_role === 'owner' ? 'owner' : 'member', membershipStatus: item.membership_status as WorkspaceMember['membershipStatus'], joinedAt: text(item.joined_at) }));
  const evidence: EvidenceCard[] = rows(evidenceResult.data).map((item) => ({ id: text(item.id), workspaceId: text(item.workspace_id), catalystId: text(item.catalyst_id), missionId: optional(item.mission_id), authorId: text(item.author_id), evidenceType: item.evidence_type as EvidenceCard['evidenceType'], title: text(item.title), summary: text(item.summary), sourceLabel: optional(item.source_label), sourceUrl: optional(item.source_url), observedAt: optional(item.observed_at), confidence: number(item.confidence), affectedAssumption: optional(item.affected_assumption), verificationStatus: item.verification_status as EvidenceCard['verificationStatus'], lastVerifiedAt: optional(item.last_verified_at), createdAt: text(item.created_at), updatedAt: text(item.updated_at) }));
  const evidenceResponses: EvidenceResponse[] = rows(responsesResult.data).map((item) => ({ id: text(item.id), evidenceId: text(item.evidence_id), workspaceId: text(item.workspace_id), authorId: text(item.author_id), responseType: item.response_type as EvidenceResponse['responseType'], body: text(item.body), sourceUrl: optional(item.source_url), createdAt: text(item.created_at) }));
  const sharedTheses: SharedThesis[] = rows(thesesResult.data).map((item) => ({ id: text(item.id), workspaceId: text(item.workspace_id), authorId: text(item.author_id), catalystId: optional(item.catalyst_id), ticker: text(item.ticker), strategy: text(item.strategy), bias: text(item.bias), thesisSummary: text(item.thesis_summary), expectedMoveSummary: optional(item.expected_move_summary), confidence: number(item.confidence), createdAt: text(item.created_at), updatedAt: text(item.updated_at) }));
  const sharedThesisResponses: SharedThesisResponse[] = rows(thesisResponsesResult.data).map((item) => ({ id: text(item.id), sharedThesisId: text(item.shared_thesis_id), workspaceId: text(item.workspace_id), authorId: text(item.author_id), responseType: item.response_type as SharedThesisResponse['responseType'], body: text(item.body), createdAt: text(item.created_at) }));
  const activity: ActivityEvent[] = rows(activityResult.data).map((item) => ({ id: text(item.id), workspaceId: text(item.workspace_id), actorId: text(item.actor_id), eventType: text(item.event_type), objectType: text(item.object_type), objectId: optional(item.object_id), summary: text(item.summary), createdAt: text(item.created_at) }));
  const missions: ResearchMission[] = rows(missionsResult.data).map((item) => ({ id: text(item.id), workspaceId: text(item.workspace_id), catalystId: text(item.catalyst_id), title: text(item.title), status: item.status as ResearchMission['status'], completedDecision: optional(item.completed_decision) as ResearchMission['completedDecision'], createdBy: text(item.created_by), createdAt: text(item.created_at), updatedAt: text(item.updated_at), completedAt: optional(item.completed_at) }));
  const missionAssignments: MissionAssignment[] = rows(assignmentsResult.data).map((item) => ({ id: text(item.id), missionId: text(item.mission_id), workspaceId: text(item.workspace_id), assigneeId: optional(item.assignee_id), createdBy: text(item.created_by), role: optional(item.role) as MissionAssignment['role'], task: text(item.task), status: item.status as MissionAssignment['status'], completedAt: optional(item.completed_at) }));
  const researchQuestions: ResearchQuestion[] = rows(questionsResult.data).map((item) => ({ id: text(item.id), missionId: text(item.mission_id), workspaceId: text(item.workspace_id), createdBy: text(item.created_by), assignedTo: optional(item.assigned_to), question: text(item.question), resolution: optional(item.resolution), status: item.status as ResearchQuestion['status'], createdAt: text(item.created_at) }));
  const liquidityObservations: LiquidityObservation[] = rows(liquidityResult.data).map((item) => ({ id: text(item.id), missionId: text(item.mission_id), workspaceId: text(item.workspace_id), createdBy: text(item.created_by), ticker: text(item.ticker), observation: text(item.observation), sourceLabel: optional(item.source_label), observedAt: text(item.observed_at), lastVerifiedAt: optional(item.last_verified_at), createdAt: text(item.created_at) }));
  const missionCheckpoints: MissionCheckpoint[] = rows(checkpointsResult.data).map((item) => ({ missionId: text(item.mission_id), workspaceId: text(item.workspace_id), checkpointType: text(item.checkpoint_type), status: item.status as MissionCheckpoint['status'], completedBy: optional(item.completed_by), completedAt: optional(item.completed_at), note: optional(item.note) }));
  const forecasts: PersonalForecast[] = rows(forecastsResult.data).map((item) => ({ id: text(item.id), userId: text(item.user_id), workspaceId: text(item.workspace_id), catalystId: text(item.catalyst_id), missionId: optional(item.mission_id), expectedResult: text(item.expected_result), marketDirection: item.market_direction as PersonalForecast['marketDirection'], expectedMagnitude: number(item.expected_magnitude), magnitudeUnit: item.magnitude_unit as PersonalForecast['magnitudeUnit'], confidence: Number(item.confidence), preferredTicker: optional(item.preferred_ticker), intendedStrategy: optional(item.intended_strategy), tradeDecision: item.trade_decision as PersonalForecast['tradeDecision'], visibility: item.visibility as PersonalForecast['visibility'], revision: Number(item.revision), lockedAt: optional(item.locked_at), createdAt: text(item.created_at), updatedAt: text(item.updated_at) }));
  const forecastRevisions: ForecastRevision[] = rows(revisionsResult.data).map((item) => ({ id: text(item.id), forecastId: text(item.forecast_id), userId: text(item.user_id), workspaceId: text(item.workspace_id), revision: Number(item.revision), snapshotType: item.snapshot_type as ForecastRevision['snapshotType'], visibility: item.visibility_at_revision as ForecastRevision['visibility'], snapshot: row(item.snapshot), revisionReason: optional(item.revision_reason), createdAt: text(item.created_at), lockedAt: optional(item.locked_at) }));
  const debriefs: MissionDebrief[] = rows(debriefsResult.data).map((item) => ({ id: text(item.id), workspaceId: text(item.workspace_id), missionId: text(item.mission_id), catalystId: text(item.catalyst_id), authorId: text(item.author_id), actualResult: text(item.actual_result), actualDirection: optional(item.actual_direction) as MissionDebrief['actualDirection'], actualMagnitude: number(item.actual_magnitude), marketReaction: text(item.market_reaction), keyDriver: optional(item.key_driver), whatWorked: optional(item.what_worked), whatMissed: optional(item.what_missed), unexpectedFactor: optional(item.unexpected_factor), sharedSummary: optional(item.shared_summary), visibility: item.visibility as MissionDebrief['visibility'], createdAt: text(item.created_at), updatedAt: text(item.updated_at) }));
  return { researchWorkspace, workspaceMembers, pendingWorkspaceInvites, evidence, evidenceResponses, sharedTheses, sharedThesisResponses, activity, missions, missionAssignments, researchQuestions, liquidityObservations, missionCheckpoints, forecasts, forecastRevisions, debriefs };
}

export function memberLabel(members: WorkspaceMember[], userId: string) {
  const member = members.find((item) => item.userId === userId);
  return member ? { initials: member.initials, name: member.displayName } : { initials: 'OJ', name: userId === 'current' ? 'You' : 'Member' };
}

export function personalCalibration(userId: string, forecasts: PersonalForecast[], debriefs: MissionDebrief[]) {
  const classified = forecasts.filter((forecast) => forecast.userId === userId && forecast.lockedAt).map((forecast) => {
    const outcome = debriefs.find((item) => item.catalystId === forecast.catalystId && item.actualDirection);
    if (!outcome?.actualDirection) return undefined;
    const directionCorrect = forecast.marketDirection === outcome.actualDirection || (forecast.marketDirection === 'neutral' && outcome.actualDirection === 'neutral');
    const magnitudeError = forecast.expectedMagnitude === undefined || outcome.actualMagnitude === undefined ? undefined : Math.abs(forecast.expectedMagnitude - outcome.actualMagnitude);
    return { forecast, directionCorrect, magnitudeError };
  }).filter(Boolean) as { forecast: PersonalForecast; directionCorrect: boolean; magnitudeError?: number }[];
  const count = classified.length;
  return {
    count,
    directionAccuracy: count ? classified.filter((item) => item.directionCorrect).length / count : undefined,
    averageConfidence: count ? classified.reduce((sum, item) => sum + item.forecast.confidence, 0) / count : undefined,
    averageMagnitudeError: classified.some((item) => item.magnitudeError !== undefined) ? classified.reduce((sum, item) => sum + (item.magnitudeError || 0), 0) / classified.filter((item) => item.magnitudeError !== undefined).length : undefined,
  };
}
