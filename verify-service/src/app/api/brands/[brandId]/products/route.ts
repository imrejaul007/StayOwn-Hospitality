import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/db'
import { authenticateRequest, requireBrandAccess } from '@/lib/auth'

const createProductSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  category: z.string().optional(),
  image: z.string().url().optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: { brandId: string } }
) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.success) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { brandId } = params

    const products = await prisma.product.findMany({
      where: { brandId },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ products })
  } catch (error) {
    console.error('Get products error:', error)
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
      return NextResponse.json({ error: auth.error }, { status: auth.error === 'No token provided' ? 401 : 403 })
    }

    const body = await request.json()
    const data = createProductSchema.parse(body)

    const product = await prisma.product.create({
      data: {
        brandId: params.brandId,
        name: data.name,
        description: data.description,
        category: data.category,
        image: data.image,
      },
    })

    return NextResponse.json({ product }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data', details: error.errors }, { status: 400 })
    }
    console.error('Create product error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
