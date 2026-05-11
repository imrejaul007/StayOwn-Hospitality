import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth'
import { claimReward } from '@/lib/rewards/issuer'

export async function POST(
  request: NextRequest,
  { params }: { params: { rewardId: string } }
) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.success) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await claimReward(params.rewardId, auth.user!.userId)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Claim reward error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
