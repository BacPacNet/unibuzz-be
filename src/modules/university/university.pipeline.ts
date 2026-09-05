import mongoose from "mongoose";
import { UniversityFilter } from "./university.interface";


export const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const DISCOVER_HIDDEN_UNIVERSITY_ID = '687e715e680e80d008715195';

export const buildDiscoverHiddenUniversityFilter = (): UniversityFilter => ({
  $nor: [
    { _id: new mongoose.Types.ObjectId(DISCOVER_HIDDEN_UNIVERSITY_ID) },
    { name: { $regex: '^unibuzz$', $options: 'i' } },
  ],
});

const toObjectIds = (ids: Array<string | mongoose.Types.ObjectId> = []): mongoose.Types.ObjectId[] =>
  ids.map((id) => (id instanceof mongoose.Types.ObjectId ? id : new mongoose.Types.ObjectId(id)));

type DiscoverRankingOptions = {
  term?: string;
  partneredUniversityIds?: Array<string | mongoose.Types.ObjectId>;
};

export const buildDiscoverRankingStages = ({
  term,
  partneredUniversityIds = [],
}: DiscoverRankingOptions = {}): mongoose.PipelineStage[] => {
  const partneredIds = toObjectIds(partneredUniversityIds);
  const escapedTerm = term ? escapeRegex(term) : '';
  const normalizedTerm = term ? term.toLowerCase() : '';

  const addFields: Record<string, unknown> = {
    partneredRank: {
      $cond: [{ $in: ['$_id', partneredIds] }, 0, 1],
    },
    indiaRank: {
      $cond: [
        {
          $or: [
            { $eq: [{ $toLower: { $ifNull: ['$country', ''] } }, 'india'] },
            { $eq: [{ $toLower: { $ifNull: ['$country_code', ''] } }, 'in'] },
          ],
        },
        0,
        1,
      ],
    },
    unirankSort: { $ifNull: ['$unirank', Number.MAX_SAFE_INTEGER] },
  };

  if (term) {
    addFields['nameMatchRank'] = {
      $switch: {
        branches: [
          { case: { $eq: [{ $toLower: '$name' }, normalizedTerm] }, then: 0 },
          { case: { $regexMatch: { input: '$name', regex: `^${escapedTerm}`, options: 'i' } }, then: 1 },
          { case: { $regexMatch: { input: '$name', regex: escapedTerm, options: 'i' } }, then: 2 },
        ],
        default: 3,
      },
    };
  }

  const sort = term
    ? { partneredRank: 1 as const, indiaRank: 1 as const, nameMatchRank: 1 as const, unirankSort: 1 as const, name: 1 as const }
    : { partneredRank: 1 as const, indiaRank: 1 as const, unirankSort: 1 as const, name: 1 as const };

  const project = term
    ? { partneredRank: 0 as const, indiaRank: 0 as const, unirankSort: 0 as const, nameMatchRank: 0 as const }
    : { partneredRank: 0 as const, indiaRank: 0 as const, unirankSort: 0 as const };

  return [{ $addFields: addFields }, { $sort: sort }, { $project: project }];
};

export const buildSearchTermOrFilter = (term: string): UniversityFilter => {
  const escapedTerm = escapeRegex(term);
  return {
    $or: [
      { name: { $regex: escapedTerm, $options: 'i' } },
      { country: { $regex: escapedTerm, $options: 'i' } },
      { type: { $regex: escapedTerm, $options: 'i' } },
    ],
  };
};
