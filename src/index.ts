import dotenv from 'dotenv';
import { HandleScheduledEventUseCaseHandler } from './adapter/entry-points/handlers/HandleScheduledEventUseCaseHandler';
import { getStoryObjectMap } from './adapter/entry-points/function/getStoryObjectMap';
dotenv.config();
export const hello = (name: string) => `hello ${name}`;
export { Project } from './domain/entities/Project';
export { Issue } from './domain/entities/Issue';
export const scheduledEvent = new HandleScheduledEventUseCaseHandler().handle;
export { getStoryObjectMap };
export {
  StoryObject,
  StoryObjectMap,
} from './domain/usecases/GetStoryObjectMapUseCase';
