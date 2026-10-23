const hb = require('../../utils/habit.js')
const store = require('../../utils/store.js')
const ach = require('../../utils/achievement.js')

// 热力图展示多少周。8 周约两个月，一屏能放下
const WEEKS = 8

Page({
  data: {
    items: [],
    totalStreak: 0,
    bestStreak: 0,
    wall: [],
    unlockedN: 0,
    totalN: 0,
    agg: { totalCheckins: 0, activeDays: 0, bestStreak: 0 }
  },

  onShow() {
    this.refresh()
  },

  refresh() {
    const today = new Date()
    const habits = store.loadHabits()
    const recs = {}
    habits.forEach(function (h) { recs[h.id] = store.getRecord(h.id) })

    const items = habits.map(function (h) {
      const rec = store.getRecord(h.id)
      const s = hb.summarize(rec, today)

      // 日历按周分组。给每列和每格都编上号 ——
      // wx:key 需要唯一标识，而这里的结构是「数组的数组」，
      // 直接用 *this 会重复，所以预先算好索引
      const raw = hb.calendarWeeks(rec, WEEKS, today)
      const weeks = raw.map(function (cells, wi) {
        return {
          wi: wi,
          cells: cells.map(function (c, di) {
            return { di: di, key: c.key, done: c.done, future: c.future, isToday: c.isToday }
          })
        }
      })

      return {
        id: h.id,
        name: h.name,
        icon: h.icon,
        color: h.color,
        streak: s.streak,
        weekPct: s.week.pct,
        weekDone: s.week.done,
        monthPct: s.month.pct,
        total: s.total,
        weeks: weeks
      }
    })

    let best = 0
    let sum = 0
    items.forEach(function (x) {
      if (x.streak > best) best = x.streak
      sum += x.streak
    })

    // 成就墙。顺手把新达成的记进持久化 —— 用户可能只在统计页看，
    // 不在这里补一次的话，成就得等下次去今日页才被记录
    const agg = hb.aggregate(habits, recs, today)
    const evaluated = ach.applyUnlocks(ach.evaluate(agg), store.loadUnlocks())
    store.recordUnlocks(evaluated, hb.dateKey(today))

    // 已解锁的排前面（这是「我拿到了什么」），未解锁的按完成度排（这是「快到了」）
    const wall = evaluated.slice().sort(function (a, b) {
      if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1
      return b.pct - a.pct
    })

    this.setData({
      items: items,
      bestStreak: best,
      totalStreak: sum,
      wall: wall,
      unlockedN: ach.unlockedCount(evaluated),
      totalN: evaluated.length,
      agg: agg
    })
  }
})
