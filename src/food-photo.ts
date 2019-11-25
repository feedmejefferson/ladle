import { ImageAnnotation } from './image-annotation';

export interface FoodPhoto {
    image: string;
    title: string;
    description: string;
    author: string;
    authorProfileUrl: URL;
    originTitle: string;
    originUrl: URL;
    foods: ImageAnnotation[];
  }
  