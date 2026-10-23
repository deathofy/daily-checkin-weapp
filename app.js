App({
  onLaunch() {
    // 首次打开铺一套示例数据（几个习惯 + 一段打卡记录），别让首页是三条零。
    // 只在「一条习惯都没有 / 一条记录都没有」时才铺，已经用过的人不受影响。
    require('./utils/store.js').ensureSeed()
  }
})
