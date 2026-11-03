import { SetMetadata } from '@nestjs/common';

export const AUTORISE_SI_MDP_A_CHANGER_KEY = 'autoriseSiMdpAChanger';

// Route accessible même si l'utilisateur doit changer son mot de passe
export const AutoriseSiMdpAChanger = () => SetMetadata(AUTORISE_SI_MDP_A_CHANGER_KEY, true);
