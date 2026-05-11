import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertCircle, RefreshCw, ShieldCheck, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { loyaltyService } from '../../services/loyaltyService';
import { withErrorBoundary } from '../../components/ErrorBoundary';

function AdminLoyaltyManager() {
  const queryClient = useQueryClient();
  const [reconcileUserId, setReconcileUserId] = useState('');
  const [campaignUserId, setCampaignUserId] = useState('');
  const [campaignId, setCampaignId] = useState('');
  const [reportMonths, setReportMonths] = useState(12);
  const [exportYear, setExportYear] = useState(new Date().getFullYear());
  const [exportMonth, setExportMonth] = useState(new Date().getMonth() + 1);
  const [ruleForm, setRuleForm] = useState({
    pointsPerCurrencyUnit: 0.1,
    pointsPerNight: 0,
    maxPointsPerStay: 50000
  });

  const { data: health, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-loyalty-health'],
    queryFn: () => loyaltyService.getAdminHealth()
  });

  const { data: runsData } = useQuery({
    queryKey: ['admin-loyalty-runs'],
    queryFn: () => loyaltyService.getReconciliationRuns(1, 20)
  });
  const { data: rulesData } = useQuery({
    queryKey: ['admin-loyalty-rules'],
    queryFn: () => loyaltyService.getRules()
  });
  const { data: campaignsData, refetch: refetchCampaigns } = useQuery({
    queryKey: ['admin-loyalty-campaigns'],
    queryFn: () => loyaltyService.getCampaigns(1, 20)
  });
  const { data: alertsData, refetch: refetchAlerts } = useQuery({
    queryKey: ['admin-loyalty-alerts'],
    queryFn: () => loyaltyService.getOpsAlerts(1, 20, 'open')
  });
  const { data: queueStats, refetch: refetchQueueStats } = useQuery({
    queryKey: ['admin-loyalty-queue-stats'],
    queryFn: () => loyaltyService.getQueueStats()
  });
  const { data: retentionReport, refetch: refetchRetention } = useQuery({
    queryKey: ['admin-loyalty-retention', reportMonths],
    queryFn: () => loyaltyService.getComplianceRetentionReport(reportMonths)
  });

  const runReconMutation = useMutation({
    mutationFn: () => loyaltyService.runReconciliation(1000),
    onSuccess: () => {
      toast.success('Reconciliation run completed');
      queryClient.invalidateQueries({ queryKey: ['admin-loyalty-health'] });
      queryClient.invalidateQueries({ queryKey: ['admin-loyalty-runs'] });
    },
    onError: () => toast.error('Failed to run reconciliation')
  });

  const runExpiryMutation = useMutation({
    mutationFn: () => loyaltyService.runExpiry(500),
    onSuccess: () => {
      toast.success('Expiry batch executed');
      queryClient.invalidateQueries({ queryKey: ['admin-loyalty-health'] });
      queryClient.invalidateQueries({ queryKey: ['admin-loyalty-runs'] });
    },
    onError: () => toast.error('Failed to run expiry batch')
  });

  const reconcileUserMutation = useMutation({
    mutationFn: () => loyaltyService.reconcileUser(reconcileUserId, true),
    onSuccess: () => {
      toast.success('User reconciled');
      setReconcileUserId('');
      queryClient.invalidateQueries({ queryKey: ['admin-loyalty-health'] });
      queryClient.invalidateQueries({ queryKey: ['admin-loyalty-runs'] });
    },
    onError: () => toast.error('Failed to reconcile user')
  });
  const evaluateAlertsMutation = useMutation({
    mutationFn: () => loyaltyService.evaluateOpsAlerts(),
    onSuccess: () => {
      toast.success('SLA alerts evaluated');
      refetchAlerts();
    },
    onError: () => toast.error('Failed to evaluate alerts')
  });
  const createRuleMutation = useMutation({
    mutationFn: () => loyaltyService.createRuleVersion(ruleForm, 'Admin update'),
    onSuccess: () => {
      toast.success('Rule version activated');
      queryClient.invalidateQueries({ queryKey: ['admin-loyalty-rules'] });
      queryClient.invalidateQueries({ queryKey: ['admin-loyalty-health'] });
    },
    onError: () => toast.error('Failed to create rule version')
  });
  const createCampaignMutation = useMutation({
    mutationFn: () =>
      loyaltyService.createCampaign({
        name: 'Phase2 Bonus Campaign',
        code: `P2-${Date.now().toString().slice(-6)}`,
        points: 100,
        startsAt: new Date().toISOString(),
        endsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        maxTotalAwards: 10000,
        maxAwardsPerUser: 1
      }),
    onSuccess: () => {
      toast.success('Campaign created');
      refetchCampaigns();
    },
    onError: () => toast.error('Failed to create campaign')
  });
  const awardCampaignMutation = useMutation({
    mutationFn: () => loyaltyService.awardCampaignBonus(campaignId, campaignUserId, `manual-${Date.now()}`),
    onSuccess: () => {
      toast.success('Bonus awarded');
      setCampaignUserId('');
      refetchCampaigns();
    },
    onError: () => toast.error('Failed to award campaign bonus')
  });
  const ackAlertMutation = useMutation({
    mutationFn: (alertId: string) => loyaltyService.acknowledgeAlert(alertId),
    onSuccess: () => {
      toast.success('Alert acknowledged');
      refetchAlerts();
    },
    onError: () => toast.error('Failed to acknowledge alert')
  });
  const enqueueJobMutation = useMutation({
    mutationFn: (type: string) => loyaltyService.enqueueQueueEvent(type, {}),
    onSuccess: () => {
      toast.success('Queue event added');
      refetchQueueStats();
    },
    onError: () => toast.error('Failed to enqueue event')
  });
  const exportMutation = useMutation({
    mutationFn: async () => loyaltyService.downloadMonthlyLiabilityCsv(exportYear, exportMonth),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `loyalty-liability-${exportYear}-${String(exportMonth).padStart(2, '0')}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Liability CSV downloaded');
    },
    onError: () => toast.error('Failed to export liability CSV')
  });

  if (isLoading) {
    return <div className="p-6">Loading loyalty manager...</div>;
  }

  if (isError || !health) {
    return (
      <div className="p-6">
        <Card className="p-6 text-center">
          <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-2" />
          <p className="mb-3">Failed to load loyalty health</p>
          <Button onClick={() => refetch()} variant="outline">Try again</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Loyalty Manager</h1>
          <p className="text-gray-600">Wallet health, reconciliation, and expiry operations</p>
        </div>
        <Button variant="outline" onClick={() => refetch()} className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-sm text-gray-500">Ledger Liability</div>
          <div className="text-xl font-semibold">{(health.totalLedgerLiability ?? 0).toLocaleString('en-IN')} pts</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-500">Mismatch Rate</div>
          <div className="text-xl font-semibold">{(health.mismatchRate ?? 0).toFixed(2)}%</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-500">Latest Run Users</div>
          <div className="text-xl font-semibold">{health.latestReconciliation?.totalUsersChecked || 0}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-500">Latest Run Mismatches</div>
          <div className="text-xl font-semibold">{health.latestReconciliation?.mismatchCount || 0}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-500">Open SLA Alerts</div>
          <div className="text-xl font-semibold">{health.openAlerts || 0}</div>
        </Card>
      </div>

      <Card className="p-4">
        <h2 className="font-semibold text-gray-900 mb-3">Operations</h2>
        <div className="flex flex-wrap gap-3 items-center">
          <Button onClick={() => runReconMutation.mutate()} disabled={runReconMutation.isPending}>
            {runReconMutation.isPending ? 'Running...' : 'Run Reconciliation'}
          </Button>
          <Button variant="outline" onClick={() => runExpiryMutation.mutate()} disabled={runExpiryMutation.isPending}>
            {runExpiryMutation.isPending ? 'Running...' : 'Run Expiry Batch'}
          </Button>
          <Button variant="outline" onClick={() => evaluateAlertsMutation.mutate()} disabled={evaluateAlertsMutation.isPending}>
            {evaluateAlertsMutation.isPending ? 'Running...' : 'Evaluate SLA Alerts'}
          </Button>
          <Button variant="outline" onClick={() => enqueueJobMutation.mutate('loyalty.expiry.run')}>
            Queue Expiry Job
          </Button>
          <Button variant="outline" onClick={() => enqueueJobMutation.mutate('loyalty.reconciliation.run')}>
            Queue Reconciliation Job
          </Button>
          <Button variant="outline" onClick={() => enqueueJobMutation.mutate('loyalty.alerts.evaluate')}>
            Queue Alerts Eval
          </Button>
          <div className="text-sm text-gray-600">Queue depth: {queueStats?.depth ?? 0}</div>
          <div className="flex items-center gap-2">
            <Input
              placeholder="User ID to repair"
              value={reconcileUserId}
              onChange={(e) => setReconcileUserId(e.target.value)}
              className="w-80"
            />
            <Button
              variant="secondary"
              onClick={() => reconcileUserMutation.mutate()}
              disabled={!reconcileUserId || reconcileUserMutation.isPending}
            >
              <ShieldCheck className="h-4 w-4 mr-1" />
              Repair User
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="font-semibold text-gray-900 mb-3">Rule Versioning and Simulation</h2>
        <div className="grid md:grid-cols-4 gap-3">
          <Input type="number" value={ruleForm.pointsPerCurrencyUnit} onChange={(e) => setRuleForm((p) => ({ ...p, pointsPerCurrencyUnit: Number(e.target.value) }))} placeholder="points per currency unit" />
          <Input type="number" value={ruleForm.pointsPerNight} onChange={(e) => setRuleForm((p) => ({ ...p, pointsPerNight: Number(e.target.value) }))} placeholder="points per night" />
          <Input type="number" value={ruleForm.maxPointsPerStay} onChange={(e) => setRuleForm((p) => ({ ...p, maxPointsPerStay: Number(e.target.value) }))} placeholder="max points per stay" />
          <Button onClick={() => createRuleMutation.mutate()} disabled={createRuleMutation.isPending}>
            {createRuleMutation.isPending ? 'Saving...' : 'Activate New Rule Version'}
          </Button>
        </div>
        <div className="text-sm text-gray-600 mt-3">
          Active version: {rulesData?.active?.version ?? 'N/A'} | Current formula: {rulesData?.active?.rules?.pointsPerCurrencyUnit ?? 0.1} per amount + {rulesData?.active?.rules?.pointsPerNight ?? 0} per night
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="font-semibold text-gray-900 mb-3">Compliance and Finance Exports</h2>
        <div className="flex flex-wrap gap-3 items-center mb-4">
          <Input type="number" className="w-40" value={reportMonths} onChange={(e) => setReportMonths(Number(e.target.value))} />
          <Button variant="outline" onClick={() => refetchRetention()}>Refresh Retention Report</Button>
          <Input type="number" className="w-32" value={exportYear} onChange={(e) => setExportYear(Number(e.target.value))} />
          <Input type="number" className="w-24" value={exportMonth} onChange={(e) => setExportMonth(Number(e.target.value))} />
          <Button onClick={() => exportMutation.mutate()} disabled={exportMutation.isPending}>
            {exportMutation.isPending ? 'Exporting...' : 'Download Monthly Liability CSV'}
          </Button>
        </div>
        <div className="max-h-56 overflow-y-auto border rounded p-3">
          {(retentionReport?.rows || []).slice(0, 20).map((row: any, idx: number) => (
            <div key={`${row.year}-${row.month}-${row.type}-${idx}`} className="text-sm py-1">
              {row.year}-{String(row.month).padStart(2, '0')} | {row.type} | count: {row.count} | points: {row.points}
            </div>
          ))}
          {(!retentionReport?.rows || retentionReport.rows.length === 0) && (
            <div className="text-sm text-gray-500">No retention data available.</div>
          )}
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="font-semibold text-gray-900 mb-3">Campaign Bonuses</h2>
        <div className="flex flex-wrap gap-3 items-center mb-3">
          <Button onClick={() => createCampaignMutation.mutate()} disabled={createCampaignMutation.isPending}>
            {createCampaignMutation.isPending ? 'Creating...' : 'Create Default Campaign'}
          </Button>
          <Input placeholder="Campaign ID" className="w-72" value={campaignId} onChange={(e) => setCampaignId(e.target.value)} />
          <Input placeholder="User ID to award" className="w-72" value={campaignUserId} onChange={(e) => setCampaignUserId(e.target.value)} />
          <Button variant="secondary" disabled={!campaignId || !campaignUserId || awardCampaignMutation.isPending} onClick={() => awardCampaignMutation.mutate()}>
            Award Bonus
          </Button>
        </div>
        <div className="space-y-2">
          {(campaignsData?.campaigns || []).slice(0, 5).map((c: any) => (
            <div key={c._id} className="border rounded p-2 text-sm">
              {c.name} ({c.code}) - {c.points} pts | awards {c.totalAwardsCount}/{c.maxTotalAwards}
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="font-semibold text-gray-900 mb-3">SLA Alerts</h2>
        <div className="space-y-2">
          {(alertsData?.alerts || []).map((a: any) => (
            <div key={a._id} className="border rounded p-3 flex items-center justify-between">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-1 text-amber-600" />
                <div>
                  <div className="font-medium">{a.type} ({a.severity})</div>
                  <div className="text-sm text-gray-600">{a.message}</div>
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => ackAlertMutation.mutate(a._id)}>Acknowledge</Button>
            </div>
          ))}
          {(!alertsData?.alerts || alertsData.alerts.length === 0) && (
            <div className="text-sm text-gray-500">No open SLA alerts.</div>
          )}
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="font-semibold text-gray-900 mb-3">Recent Reconciliation Runs</h2>
        <div className="space-y-2">
          {(runsData?.runs || []).map((run: any) => (
            <div key={run._id} className="border rounded p-3 flex items-center justify-between">
              <div>
                <div className="font-medium">{new Date(run.createdAt).toLocaleString()}</div>
                <div className="text-sm text-gray-500">Status: {run.status}</div>
              </div>
              <div className="text-sm text-gray-700">
                Checked: {run.totalUsersChecked} | Mismatch: {run.mismatchCount} | Repaired: {run.repairedCount || 0}
              </div>
            </div>
          ))}
          {(!runsData?.runs || runsData.runs.length === 0) && (
            <div className="text-sm text-gray-500">No reconciliation runs yet.</div>
          )}
        </div>
      </Card>
    </div>
  );
}

export default withErrorBoundary(AdminLoyaltyManager);
