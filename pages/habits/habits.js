const store = require('../../utils/store.js')
const presets = require('../../utils/presets.js')

Page({
  data: {
    habits: [],
    icons: store.ICONS,
    colors: store.COLORS,
    name: '',
    icon: store.ICONS[0],
    color: store.COLORS[0],
    presetCats: []
  },

  onShow() {
    this.refresh()
  },

  refresh() {
    const habits = store.loadHabits()
    const names = habits.map(function (h) { return h.name })

    this.setData({
      habits: habits,
      // 按名字标出「已经加过」，避免推荐里再点一次加出两条同名习惯
      presetCats: presets.markAdded(presets.CATEGORIES, names)
    })
  },

  /**
   * 从推荐里加一条。
   *
   * 已经有的不重复加 —— 用户可能自己手打过同名的，那也该算已经有了。
   * 点一下没反应比加出两条一样的习惯好。
   */
  addPreset(e) {
    const name = e.currentTarget.dataset.name
    if (!name) return

    const exists = store.loadHabits().some(function (h) { return h.name === name })
    if (exists) {
      wx.showToast({ title: '已经加过了', icon: 'none' })
      return
    }

    const p = presets.byName(name)
    store.addHabit(name, p ? p.icon : '', p ? p.color : '')
    this.refresh()
    wx.showToast({ title: '已添加', icon: 'success' })
  },

  onName(e) {
    this.setData({ name: e.detail.value })
  },

  pickIcon(e) {
    this.setData({ icon: e.currentTarget.dataset.v })
  },

  pickColor(e) {
    this.setData({ color: e.currentTarget.dataset.v })
  },

  add() {
    const name = String(this.data.name || '').trim()
    if (!name) {
      wx.showToast({ title: '给习惯起个名字', icon: 'none' })
      return
    }
    if (name.length > 12) {
      wx.showToast({ title: '名字别超过 12 个字', icon: 'none' })
      return
    }

    store.addHabit(name, this.data.icon, this.data.color)

    // 清空表单，但保留图标和颜色的选择 —— 连续添加时少点两次
    this.setData({ name: '' })
    this.refresh()
    wx.showToast({ title: '已添加', icon: 'success' })
  },

  remove(e) {
    const id = e.currentTarget.dataset.id
    const name = e.currentTarget.dataset.name

    // 删除要确认 —— 会连同这个习惯的全部打卡记录一起删掉，不可撤销
    wx.showModal({
      title: '删除习惯',
      content: '「' + name + '」的全部打卡记录会一起删除，不可恢复。',
      confirmText: '删除',
      confirmColor: '#e8674a',
      success: (r) => {
        if (!r.confirm) return
        store.removeHabit(id)
        this.refresh()
        wx.showToast({ title: '已删除', icon: 'none' })
      }
    })
  }
})
