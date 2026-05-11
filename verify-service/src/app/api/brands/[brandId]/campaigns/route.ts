import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireBrandAccess } from '@/lib/auth'
import { createCampaign, getBrandCampaigns } from '@/lib/campaigns/manager'

const createCampaignSchema = z.object({
  productId: z.string().optional(),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  type: z.enum(['PER_SCAN', 'FIRST_N', 'GEO_TARGETED', 'TIME_BOOST']),
  rewardType: z.enum(['COINS', 'DISCOUNT', 'FREE_PRODUCT']),
  rewardAmount: z.number().min(1),
  cap: z.number().optional(),
  targeting: z.object({
    locations: z.array(z.object({
      lat: z.number(),
      lng: z.number(),
      radius: z.number(),
    })).optional(),
    timeSlots: z.array(z.object({
      start: z.number(),
      end: z.number(),
    })).optional(),
  }).optional(),
  startDate: z.string().transform((s) => new Date(s)),
  endDate: z.string().transform((s) => new Date(s)).optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: { brandId: string } }
) {
  try {
    const auth = await requireBrandAccess(request, params.brandId)
    if (!auth.success) {
      return NextResponse.json({ error: auth.error }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') as any
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    const { campaigns, total } = await getBrandCampaigns(params.brandId, {
      status,
      limit,
      offset,
    })

    return NextResponse.json({ campaigns, total, limit, offset })
  } catch (error) {
    console.error('Get campaigns error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { brandId: string } }
) {
  try {
    const auth = await requireBrandAccess(request, params.brandId)
    if (!auth.success) {
      return NextResponse.json({ error: auth.error }, { status: 401 })
    }

    const body = await request.json()
    const data = createCampaignSchema.parse(body)

    const result = await createCampaign({
      brandId: params.brandId,
      ...data,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ campaignId: result.campaignId }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data', details: error.errors }, { status: 400 })
    }
    console.error('Create campaign error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
