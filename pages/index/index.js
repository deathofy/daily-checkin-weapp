const hb = require('../../utils/habit.js')
const store = require('../../utils/store.js')
const ach = require('../../utils/achievement.js')

const WEEKDAY = ['日', '一', '二', '三', '四', '五', '六']

/** 成就区最多显示几个徽章，多的收成「+N」 */
const MAX_BADGES = 5

Page({
  data: {
    board: [],
    total: 0,
    doneCount: 0,
    pct: 0,
    dateLabel: '',
    stats: { totalCheckins: 0, bestStreak: 0, activeDays: 0 },
    week: [],
    badges: [],
    moreCount: 0,
    next: null
  },

  // 用 onShow：从「习惯」页加完习惯返回时要刷新
  onShow() {
    this.refresh()
  },

  /** 本周条：最近 7 天，任意习惯有打卡就点亮，全勤再单独标一下 */
  buildWeek(board, recs, today) {
    const out = []
    for (let i = 6; i >= 0; i--) {
      const d = hb.shiftDays(today, -i)
      const k = hb.dateKey(d)
      let done = 0

      board.forEach(function (h) {
        if ((recs[h.id] || {})[k]) done++
      })

      out.push({
        key: k,
        wd: WEEKDAY[d.getDay()],
        done: done > 0,
        full: board.length > 0 && done === board.length,
        isToday: i === 0
      })
    }
    return out
  },

  /**
   * 把所有要显示的东西一次算出来。
   * refresh 和 toggle 都走这里，避免两处各算一遍算出不一样的结果。
   */
  collect() {
    const today = new Date()
    const todayK = hb.dateKey(today)

    const board = store.todayBoard(todayK).map(function (h) {
      const rec = store.getRecord(h.id)
      return Object.assign({}, h, { streak: hb.streak(rec, today) })
    })

    // 每个习惯的记录取一次就够了，下面统计、本周条、汇总都复用
    const recs = {}
    board.forEach(function (h) { recs[h.id] = store.getRecord(h.id) })

    const stats = hb.aggregate(board, recs, today)

    let done = 0
    board.forEach(function (h) { if (h.done) done++ })

    const evaluated = ach.applyUnlocks(ach.evaluate(stats), store.loadUnlocks())
    const unlocked = ach.unlockedList(evaluated)

    // 徽章按「最近拿到的」排前面 —— 用户刚解锁的那个最想看到
    const badges = unlocked.slice().sort(function (a, b) {
      return String(b.unlockedAt || '').localeCompare(String(a.unlockedAt || ''))
    }).slice(0, MAX_BADGES)

    return {
      board: board,
      todayK: todayK,
      total: board.length,
      doneCount: done,
      pct: board.length ? Math.round((done * 100) / board.length) : 0,
      dateLabel: (today.getMonth() + 1) + '月' + today.getDate() + '日 周' + WEEKDAY[today.getDay()],
      stats: {
        totalCheckins: stats.totalCheckins,
        bestStreak: stats.bestStreak,
        activeDays: stats.activeDays
      },
      week: this.buildWeek(board, recs, today),
      evaluated: evaluated,
      badges: badges,
      moreCount: Math.max(0, unlocked.length - badges.length),
      next: ach.nextUp(evaluated),
      unlockedIds: unlocked.map(function (a) { return a.id })
    }
  },

  refresh() {
    const d = this.collect()

    const known = {}
    d.unlockedIds.forEach(function (id) { known[id] = true })
    this.known = known

    // 新达成的写进持久化记录（已记过的不动）
    store.recordUnlocks(d.evaluated, d.todayK)
    this.setData(d)
  },

  toggle(e) {
    const id = e.currentTarget.dataset.id
    const todayK = hb.dateKey(new Date())
    store.toggle(id, todayK)

    // 整页重算而不是只改这一行：一次打卡可能刚好凑够某个成就，
    // 徽章、进度、累计统计都要跟着变。习惯就几条，重算的开销可以忽略
    const d = this.collect()

    const prev = this.known || {}
    const fresh = d.unlockedIds.filter(function (aid) { return !prev[aid] })

    const known = {}
    d.unlockedIds.forEach(function (aid) { known[aid] = true })
    this.known = known

    store.recordUnlocks(d.evaluated, d.todayK)
    this.setData(d)

    if (fresh.length) {
      const a = d.evaluated.filter(function (x) { return x.id === fresh[0] })[0]
      wx.showToast({
        title: '🏅 解锁「' + (a ? a.name : '成就') + '」',
        icon: 'none',
        duration: 2000
      })
    }
  },

  toHabits() {
    wx.switchTab({ url: '/pages/habits/habits' })
  }
})
