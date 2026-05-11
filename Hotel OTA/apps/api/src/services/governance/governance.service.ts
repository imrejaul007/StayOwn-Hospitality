import { prisma } from '../../config/database';
import { Errors } from '../../utils/errors';

/**
 * Governance Service for Hotel Owners Trust (HOT)
 * Token-weighted voting on proposals, dividend distribution
 */
export class GovernanceService {
  /**
   * Create a governance proposal
   */
  static async createProposal(data: {
    title: string;
    description: string;
    proposalType: string;
    proposedBy: string;
    votingStartAt?: Date;
    votingEndAt?: Date;
  }) {
    return prisma.governanceProposal.create({ data: {
      title: data.title,
      description: data.description,
      proposalType: data.proposalType,
      proposedBy: data.proposedBy,
      votingStartAt: data.votingStartAt,
      votingEndAt: data.votingEndAt,
      status: data.votingStartAt ? 'voting' : 'draft',
    }});
  }

  /**
   * Cast a vote (token-weighted)
   */
  static async castVote(proposalId: string, hotelId: string, vote: 'for' | 'against' | 'abstain') {
    const proposal = await prisma.governanceProposal.findUnique({ where: { id: proposalId } });
    if (!proposal) throw Errors.notFound('Proposal');
    if (proposal.status !== 'voting') throw Errors.validation('Voting is not open');
    if (proposal.votingEndAt && proposal.votingEndAt < new Date()) throw Errors.validation('Voting period ended');

    // Get hotel's vested ownership units (voting weight)
    const vestedUnits = await prisma.ownershipTokenLedger.aggregate({
      where: { hotelId, vestingStatus: 'vested' },
      _sum: { unitsIssued: true },
    });
    const weight = Number(vestedUnits._sum.unitsIssued || 0);
    if (weight === 0) throw Errors.validation('No vested units — cannot vote');

    return prisma.governanceVote.upsert({
      where: { proposalId_hotelId: { proposalId, hotelId } },
      create: { proposalId, hotelId, vote, weightUnits: weight },
      update: { vote, weightUnits: weight },
    });
  }

  /**
   * Tally votes and resolve proposal
   */
  static async tallyVotes(proposalId: string) {
    const proposal = await prisma.governanceProposal.findUnique({ where: { id: proposalId } });
    if (!proposal) throw Errors.notFound('Proposal');

    const votes = await prisma.governanceVote.findMany({ where: { proposalId } });

    const forWeight = votes.filter((v) => v.vote === 'for').reduce((s, v) => s + Number(v.weightUnits), 0);
    const againstWeight = votes.filter((v) => v.vote === 'against').reduce((s, v) => s + Number(v.weightUnits), 0);
    const totalWeight = votes.reduce((s, v) => s + Number(v.weightUnits), 0);

    // Get total vested units across all hotels
    const totalVested = await prisma.ownershipTokenLedger.aggregate({
      where: { vestingStatus: 'vested' },
      _sum: { unitsIssued: true },
    });
    const totalEligible = Number(totalVested._sum.unitsIssued || 0);
    const quorumMet = totalEligible > 0 ? (totalWeight / totalEligible) * 100 >= Number(proposal.quorumPct) : false;
    const passed = quorumMet && forWeight > againstWeight;

    await prisma.governanceProposal.update({
      where: { id: proposalId },
      data: { status: passed ? 'passed' : 'rejected' },
    });

    return {
      forWeight, againstWeight, totalWeight, totalEligible,
      quorumPct: totalEligible > 0 ? (totalWeight / totalEligible) * 100 : 0,
      quorumMet, passed, voterCount: votes.length,
    };
  }

  /**
   * List proposals
   */
  static async listProposals(status?: string) {
    const where: any = {};
    if (status) where.status = status;

    return prisma.governanceProposal.findMany({
      where, orderBy: { createdAt: 'desc' },
      include: { _count: { select: { votes: true } } },
    });
  }

  /**
   * Create dividend distribution
   */
  static async createDividend(periodYear: number, totalAmountPaise: number) {
    // Get all hotels with vested units
    const hotelUnits = await prisma.ownershipTokenLedger.groupBy({
      by: ['hotelId'],
      where: { vestingStatus: 'vested' },
      _sum: { unitsIssued: true },
    });

    const totalUnits = hotelUnits.reduce((s, h) => s + Number(h._sum.unitsIssued || 0), 0);
    if (totalUnits === 0) throw Errors.validation('No vested units in the system');

    const perUnitPaise = totalAmountPaise / totalUnits;

    const distribution = await prisma.dividendDistribution.create({
      data: {
        periodYear, totalAmountPaise, totalUnitsEligible: totalUnits, perUnitPaise,
      },
    });

    // Create payouts for each hotel
    const payouts = hotelUnits.map((h) => ({
      distributionId: distribution.id,
      hotelId: h.hotelId,
      unitsHeld: Number(h._sum.unitsIssued || 0),
      payoutAmountPaise: Math.round(Number(h._sum.unitsIssued || 0) * perUnitPaise),
    }));

    await prisma.dividendPayout.createMany({ data: payouts });

    return { distributionId: distribution.id, totalHotels: payouts.length, perUnitPaise, totalAmountPaise };
  }

  /**
   * Get dividends for a hotel
   */
  static async getHotelDividends(hotelId: string) {
    return prisma.dividendPayout.findMany({
      where: { hotelId },
      include: { distribution: true },
      orderBy: { distribution: { periodYear: 'desc' } },
    });
  }
}
