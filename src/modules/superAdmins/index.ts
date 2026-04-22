import superAdminsModel from './superAdmins.model';
import * as superAdminsService from './superAdmins.service';
import { requireSuperAdmin } from './superAdmins.middleware';

export { superAdminsModel, superAdminsService, requireSuperAdmin };
export { ISuperAdmin } from './superAdmins.interface';
