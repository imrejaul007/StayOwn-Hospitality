import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { hashPassword } from '@/lib/auth'
import crypto from 'crypto'

const createBrandSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  email: z.string().email(),
  phone: z.string().optional(),
  logo: z.string().url().optional(),
  plan: z.enum(['STARTER', 'GROWTH', 'ENTERPRISE']).default('STARTER'),
})

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.success || auth.user!.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    const where: any = {}
    if (status) where.status = status

    const [brands, total] = await Promise.all([
      prisma.brand.findMany({
        where,
        include: {
          _count: {
            select: { products: true, campaigns: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.brand.count({ where }),
    ])

    return NextResponse.json({ brands, total, limit, offset })
  } catch (error) {
    console.error('Get brands error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.success || auth.user!.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const data = createBrandSchema.parse(body)

    const secretKey = crypto.randomBytes(32).toString('hex')

    const brand = await prisma.brand.create({
      data: {
        name: data.name,
        slug: data.slug,
        email: data.email,
        phone: data.phone,
        logo: data.logo,
        plan: data.plan,
        secretKey,
        status: 'ACTIVE',
      },
    })

    await prisma.brandCoinSettings.create({
      data: {
        brandId: brand.id,
        coinName: `${data.name} Coins`,
        coinSymbol: data.slug.substring(0, 3).toUpperCase(),
      },
    })

    return NextResponse.json({ brand, secretKey }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data', details: error.errors }, { status: 400 })
    }
    console.error('Create brand error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
