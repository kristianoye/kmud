
const
    Dirs = await requireAsync('./Dirs');

module.exports = Object.freeze({
    LIB_DROP: Dirs.DIR_BASE_MIXINS + '/Drop.js',
    LIB_GET: Dirs.DIR_BASE_MIXINS + '/Get.js',
    LIB_LISTEN: Dirs.DIR_BASE_MIXINS + '/Listen.js',
    LIB_LOOK: Dirs.DIR_BASE_MIXINS + '/Look.js',
    LIB_PUT: Dirs.DIR_BASE_MIXINS + '/Put.js',
});
