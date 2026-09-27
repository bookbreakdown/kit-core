import { registerRootComponent } from 'expo';
import { registerPlaybackService } from '@libraryofages/player';
import App from './App';

registerPlaybackService();
registerRootComponent(App);
