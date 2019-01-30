/*
 * The body daemon is responsible for initializing the living bodies of
 * both players and non-players.  It returns collections of limbs and
 * information about how many hit points and armor each limb has in
 * addition to whether the loss of any given limb is fatal or if the
 * limb has digits (in which case it can wield a weapon too).
 */
class BodyDaemon extends MUDObject {
    /**
     * Get initialization data for a particular body type.
     * @param {string} bodyType The type of body to generate.
     * @returns {Object.<string,{factor:number, fatal:boolean, fingers:number }>} Information about the body limbs
     */
    getBody(bodyType) {
        switch (bodyType) {
            case 'dragon':
                return {
                    'head': { factor: 2.5, fatal: true },
                    'neck': { factor: 2, fatal: true },
                    'right foreleg': { factor: 2 },
                    'left foreleg': { factor: 2 },
                    'right hand': { factor: 1.5, fingers: 5 },
                    'left hand': { factor: 1.5, fingers: 5 },
                    'torso': { factor: 3, fatal: true },
                    'tail': { factor: 1.5 },
                    'right hind leg': { factor: 2 },
                    'left hind leg': { factor: 2 },
                    'right foot': { factor: 1.5 },
                    'left foot': { factor: 1.5 }
                };

            case 'spider':
                return {
                    'right fang': { factor: 0.65 },
                    'left fang': { factor: 0.65 },
                    'cephalothorax ': { factor: 0.95, fatal: true, attached: [] },
                    'abdomen': { factor: 0.95, fatal: true, attached: [] },
                    'front right leg': { factor: 0.5 },
                    'front left leg': { factor: 0.5 },
                    'second left leg': { factor: 0.5 },
                    'second right leg': { factor: 0.5 },
                    'third left leg': { factor: 0.5 },
                    'third right leg': { factor: 0.5 },
                    'fourth right leg': { factor: 0.5 },
                    'fourth left leg': { factor: 0.5 }
                }

            case 'human':
            default:
                return {
                    'head': { factor: 0.85, fatal: true, attached:[] },
                    'torso': { factor: 0.95, fatal: true, attached: [] },
                    'left arm': { factor: 0.85, attached: [ 'left hand' ] },
                    'left hand': { factor: 0.5, attached: [], fingers: 5 },
                    'right arm': { factor: 0.85, attached: [] },
                    'right hand': { factor: 0.5, attached: [], fingers: 5 },
                    'left leg': { factor: 0.85, attached: ['left foot'] },
                    'left foot': { factor: 0.5, attached: [] },
                    'right leg': { factor: 0.85, attached: ['right foot'] },
                    'right foot': { factor: 0.5, attached: [ ] },
                };
        }
    }
}

module.exports = BodyDaemon;
