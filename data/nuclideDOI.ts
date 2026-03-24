
import { DOI_SEGMENT_1 } from './nuclideDOI/nuclideDOI_1_10';
import { DOI_SEGMENT_2 } from './nuclideDOI/nuclideDOI_11_40';
import { DOI_SEGMENT_3 } from './nuclideDOI/nuclideDOI_41_80';
import { DOI_SEGMENT_4 } from './nuclideDOI/nuclideDOI_81_100';
import { DOI_SEGMENT_5 } from './nuclideDOI/nuclideDOI_101_118';

/**
 * Static mapping of Nuclide (Z-A) to Digital Object Identifier (DOI) of significant academic papers.
 * This record is composed of segmented data files for better maintainability and scientific categorization.
 * 
 * All DOIs verified against https://doi.org for resolution as of 2024.
 * Format: "Z-A": "DOI_STRING"
 */
export const NUCLIDE_DOI: Record<string, string> = {
  ...DOI_SEGMENT_1,
  ...DOI_SEGMENT_2,
  ...DOI_SEGMENT_3,
  ...DOI_SEGMENT_4,
  ...DOI_SEGMENT_5
};
