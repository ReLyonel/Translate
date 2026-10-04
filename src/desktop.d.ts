import type { DesktopAPI } from '../desktop/contracts';
declare global { interface Window { desktop: DesktopAPI } }
