import mongoose from "mongoose";
import { UniversityFilter } from "./university.interface";


export const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const buildNameMatchRankingStages = (term: string): mongoose.PipelineStage[] => {
  const escapedTerm = escapeRegex(term);
  const normalizedTerm = term.toLowerCase();

  return [
    {
      $addFields: {
        nameMatchRank: {
          $switch: {
            branches: [
              { case: { $eq: [{ $toLower: '$name' }, normalizedTerm] }, then: 0 },
              { case: { $regexMatch: { input: '$name', regex: `^${escapedTerm}`, options: 'i' } }, then: 1 },
              { case: { $regexMatch: { input: '$name', regex: escapedTerm, options: 'i' } }, then: 2 },
            ],
            default: 3,
          },
        },
      },
    },
    { $sort: { nameMatchRank: 1, name: 1 } },
    {
      $project: {
        nameMatchRank: 0,
      },
    },
  ];
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