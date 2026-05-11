import { NextRequest, NextResponse } from 'next/server'
import { requireBrandAccess } from '@/lib/auth'
import { activateCampaign, pauseCampaign, completeCampaign, getCampaignSummary } from '@/lib/campaigns/manager'

export async function GET(
  request: NextRequest,
  { params }: { params: { brandId: string; campaignId: string } }
) {
  try {
    const auth = await requireBrandAccess(request, params.brandId)
    if (!auth.success) {
      return NextResponse.json({ error: auth.error }, { status: 401 })
    }

    const summary = await getCampaignSummary(params.campaignId)
    if (!summary) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    return NextResponse.json({ campaign: summary })
  } catch (error) {
    console.error('Get campaign error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { brandId: string; campaignId: string } }
) {
  try {
    const auth = await requireBrandAccess(request, params.brandId)
    if (!auth.success) {
      return NextResponse.json({ error: auth.error }, { status: 401 })
    }

    const body = await request.json()
    const { action } = body

    let result: { success: boolean; error?: string }

    switch (action) {
      case 'activate':
        result = await activateCampaign(params.campaignId)
        break
      case 'pause':
        result = await pauseCampaign(params.campaignId)
        break
      case 'complete':
        result = await completeCampaign(params.campaignId)
        break
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Update campaign error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
