import { BoundingBox } from './bounding-box';

export interface ImageAnnotation {
    boundingBox?: BoundingBox;
    primaryTag: string;
    secondaryFoodTags: string[];
    additionalTags: string[];
}
  