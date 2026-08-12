import { supabase } from '../lib/supabase';
import type { EvidenceType, PersonalForecast, TradeIdea } from '../types/domain';

async function approvedUser() {
  if (!supabase) throw new Error('Cloud is not configured.');
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Sign in to continue.');
  const profile = await supabase.from('profiles').select('approved,account_status').eq('id', user.id).maybeSingle();
  if (!profile.data?.approved || profile.data.account_status !== 'active') throw new Error('This account is not approved.');
  return user;
}

export async function renameResearchWorkspace(workspaceId: string, name: string) {
  await approvedUser();
  const { error } = await supabase!.rpc('rename_workspace', { p_workspace_id: workspaceId, p_name: name });
  if (error) throw error;
}

export async function acceptWorkspaceInvite(inviteId: string) {
  await approvedUser();
  const { data, error } = await supabase!.rpc('accept_workspace_invite', { p_invite_id: inviteId });
  if (error) throw error;
  return String(data);
}

export async function leaveResearchWorkspace(workspaceId: string) {
  await approvedUser();
  const { error } = await supabase!.rpc('leave_workspace', { p_workspace_id: workspaceId });
  if (error) throw error;
}

export async function removeWorkspaceMember(workspaceId: string, userId: string) {
  await approvedUser();
  const { error } = await supabase!.rpc('remove_workspace_member', { p_workspace_id: workspaceId, p_user_id: userId });
  if (error) throw error;
}

export async function addEvidence(input: { workspaceId: string; catalystId: string; missionId?: string; evidenceType: EvidenceType; title: string; summary: string; sourceLabel?: string; sourceUrl?: string; confidence?: number; affectedAssumption?: string; verificationStatus: 'unverified' | 'verified' | 'needs_review' }) {
  const user = await approvedUser();
  const { data, error } = await supabase!.from('evidence_cards').insert({
    workspace_id: input.workspaceId, catalyst_id: input.catalystId, mission_id: input.missionId || null, author_id: user.id,
    evidence_type: input.evidenceType, title: input.title.trim(), summary: input.summary.trim(), source_label: input.sourceLabel?.trim() || null,
    source_url: input.sourceUrl?.trim() || null, confidence: input.confidence ?? null, affected_assumption: input.affectedAssumption?.trim() || null,
    verification_status: input.verificationStatus, last_verified_at: input.verificationStatus === 'verified' ? new Date().toISOString() : null,
  }).select('id').single();
  if (error) throw error;
  return String(data.id);
}

export async function respondToEvidence(input: { evidenceId: string; workspaceId: string; responseType: 'comment' | 'confirm' | 'challenge' | 'counter_source'; body: string; sourceUrl?: string }) {
  const user = await approvedUser();
  const { error } = await supabase!.from('evidence_responses').insert({ evidence_id: input.evidenceId, workspace_id: input.workspaceId, author_id: user.id, response_type: input.responseType, body: input.body.trim(), source_url: input.sourceUrl?.trim() || null });
  if (error) throw error;
}

export async function shareIdeaThesis(input: { workspaceId: string; idea: TradeIdea; catalystId?: string; thesisSummary: string; expectedMoveSummary?: string; confidence?: number }) {
  const user = await approvedUser();
  const strategy = input.idea.strategy.toLowerCase().includes('bear') ? 'bear-put-spread' : 'bull-call-spread';
  const { data, error } = await supabase!.from('shared_theses').insert({
    workspace_id: input.workspaceId, author_id: user.id, source_trade_idea_id: input.idea.id, catalyst_id: input.catalystId || null,
    ticker: input.idea.ticker.toUpperCase(), strategy, bias: input.idea.bias, thesis_summary: input.thesisSummary.trim(),
    expected_move_summary: input.expectedMoveSummary?.trim() || null, confidence: input.confidence ?? null,
  }).select('id').single();
  if (error) throw error;
  return String(data.id);
}

export async function respondToSharedThesis(input: { sharedThesisId: string; workspaceId: string; responseType: 'comment' | 'question' | 'challenge'; body: string }) {
  const user = await approvedUser();
  const { error } = await supabase!.from('shared_thesis_responses').insert({ shared_thesis_id: input.sharedThesisId, workspace_id: input.workspaceId, author_id: user.id, response_type: input.responseType, body: input.body.trim() });
  if (error) throw error;
}

export async function archiveSharedThesis(sharedThesisId: string) {
  const user = await approvedUser();
  const { data, error } = await supabase!.from('shared_theses').update({ archived_at: new Date().toISOString() })
    .eq('id', sharedThesisId).eq('author_id', user.id).is('archived_at', null).select('id').maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Only the author can remove this thesis, or it has already been removed.');
}

export async function forkSharedThesis(sharedThesisId: string) {
  await approvedUser();
  const { data, error } = await supabase!.rpc('fork_shared_thesis', { p_shared_thesis_id: sharedThesisId });
  if (error) throw error;
  return String(data);
}

export async function createResearchMission(input: { workspaceId: string; catalystId: string; title: string }) {
  const user = await approvedUser();
  const { data, error } = await supabase!.from('research_missions').insert({ workspace_id: input.workspaceId, catalyst_id: input.catalystId, title: input.title.trim(), status: 'active', created_by: user.id }).select('id').single();
  if (error) throw error;
  return String(data.id);
}

export async function addMissionAssignment(input: { missionId: string; workspaceId: string; assigneeId?: string; role?: string; task: string }) {
  const user = await approvedUser();
  const { error } = await supabase!.from('mission_assignments').insert({ mission_id: input.missionId, workspace_id: input.workspaceId, assignee_id: input.assigneeId || null, created_by: user.id, role: input.role || null, task: input.task.trim() });
  if (error) throw error;
}

export async function addResearchQuestion(input: { missionId: string; workspaceId: string; question: string; assignedTo?: string }) {
  const user = await approvedUser();
  const { error } = await supabase!.from('research_questions').insert({ mission_id: input.missionId, workspace_id: input.workspaceId, created_by: user.id, assigned_to: input.assignedTo || null, question: input.question.trim() });
  if (error) throw error;
}

export async function addLiquidityObservation(input: { missionId: string; workspaceId: string; ticker: string; observation: string; sourceLabel?: string }) {
  const user = await approvedUser();
  const now = new Date().toISOString();
  const { error } = await supabase!.from('options_liquidity_observations').insert({ mission_id: input.missionId, workspace_id: input.workspaceId, created_by: user.id, ticker: input.ticker.toUpperCase(), observation: input.observation.trim(), source_label: input.sourceLabel?.trim() || null, observed_at: now, last_verified_at: now });
  if (error) throw error;
}

export async function setMissionCheckpoint(input: { missionId: string; checkpointType: string; completed: boolean; note?: string }) {
  await approvedUser();
  const { error } = await supabase!.rpc('set_mission_checkpoint', { p_mission_id: input.missionId, p_checkpoint_type: input.checkpointType, p_completed: input.completed, p_note: input.note || '' });
  if (error) throw error;
}

export async function completeResearchMission(missionId: string, decision: 'trade' | 'watch' | 'no_trade') {
  await approvedUser();
  const { error } = await supabase!.rpc('complete_research_mission', { p_mission_id: missionId, p_decision: decision });
  if (error) throw error;
}

export async function savePersonalForecast(input: { forecastId?: string; workspaceId: string; catalystId: string; missionId?: string; expectedResult: string; marketDirection: PersonalForecast['marketDirection']; expectedMagnitude?: number; magnitudeUnit: PersonalForecast['magnitudeUnit']; confidence: number; preferredTicker?: string; intendedStrategy?: string; tradeDecision: PersonalForecast['tradeDecision']; visibility: PersonalForecast['visibility']; expectedRevision?: number; revisionReason?: string }) {
  await approvedUser();
  const { data, error } = await supabase!.rpc('save_personal_forecast', {
    p_forecast_id: input.forecastId || null, p_workspace_id: input.workspaceId, p_catalyst_id: input.catalystId, p_mission_id: input.missionId || null,
    p_expected_result: input.expectedResult, p_expected_result_data: {}, p_market_direction: input.marketDirection,
    p_expected_magnitude: input.expectedMagnitude ?? null, p_magnitude_unit: input.magnitudeUnit, p_confidence: input.confidence,
    p_preferred_ticker: input.preferredTicker || null, p_intended_strategy: input.intendedStrategy || null, p_trade_decision: input.tradeDecision,
    p_visibility: input.visibility, p_expected_revision: input.expectedRevision ?? null, p_revision_reason: input.revisionReason || null,
  });
  if (error) throw new Error(error.message || 'Forecast update failed.');
  return String(data);
}

export async function lockPersonalForecast(forecastId: string, expectedRevision: number) {
  await approvedUser();
  const { data, error } = await supabase!.rpc('lock_personal_forecast', { p_forecast_id: forecastId, p_expected_revision: expectedRevision });
  if (error) throw new Error(error.message || 'Forecast could not be locked.');
  return String(data);
}

export async function setForecastVisibility(forecastId: string, visibility: 'private' | 'workspace') {
  await approvedUser();
  const { error } = await supabase!.rpc('set_forecast_visibility', { p_forecast_id: forecastId, p_visibility: visibility });
  if (error) throw new Error(error.message || 'Forecast visibility could not be changed.');
}

export async function saveMissionDebrief(input: { workspaceId: string; missionId: string; catalystId: string; actualResult: string; actualDirection?: string; actualMagnitude?: number; marketReaction: string; keyDriver?: string; whatWorked?: string; whatMissed?: string; unexpectedFactor?: string; sharedSummary?: string; visibility: 'private' | 'workspace' }) {
  const user = await approvedUser();
  const { error } = await supabase!.from('mission_debriefs').upsert({
    workspace_id: input.workspaceId, mission_id: input.missionId, catalyst_id: input.catalystId, author_id: user.id,
    actual_result: input.actualResult.trim(), actual_direction: input.actualDirection || null, actual_magnitude: input.actualMagnitude ?? null,
    market_reaction: input.marketReaction.trim(), key_driver: input.keyDriver?.trim() || null, what_worked: input.whatWorked?.trim() || null,
    what_missed: input.whatMissed?.trim() || null, unexpected_factor: input.unexpectedFactor?.trim() || null,
    shared_summary: input.sharedSummary?.trim() || null, visibility: input.visibility,
  }, { onConflict: 'mission_id,author_id' });
  if (error) throw error;
}
