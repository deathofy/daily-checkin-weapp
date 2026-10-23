/**
 * 习惯与打卡记录的本地存储
 *
 * 存储结构：
 *   habits  : [{ id, name, icon, color, createdAt }]
 *   records : { habitId: { 'YYYY-MM-DD': true } }
 *
 * 记录用「习惯 id → 日期字典」而不是「日期 → 习惯数组」：
 * 单个习惯的统计（连续天数、完成率）是最常查的东西，
 * 按习惯分组之后就是一次字典查找，不用遍历所有日期。
 */

const presets = require('./presets.js')
const hb = require('./habit.js')

const HABITS_KEY = 'habits'
const RECORDS_KEY = 'records'
const UNLOCKS_KEY = 'achievement_unlocks'

/**
 * 内置的一套图标和配色，新建习惯时轮着用。
 * 图标要覆盖到预设习惯库（utils/presets.js）里用到的那些，
 * 否则用户从推荐里加完习惯、想改图标时会发现选不到同一个。
 */
const ICONS = [
  '☀', '🌙', '📖', '📚', '✍', '🎧', '📝', '💻',
  '🏃', '💪', '🧘', '👟', '🥗', '💧', '🍳', '💰',
  '✅', '📋', '⏱', '📥', '🔍', '🎯', '🔥', '🏆'
]
const COLORS = ['#e8674a', '#4a9e6f', '#4a7ab5', '#c79a3a', '#8a6bb5', '#c25a7a']

function loadHabits() {
  try {
    const a = wx.getStorageSync(HABITS_KEY)
    return a && a.length ? a : []
  } catch (e) {
    return []
  }
}

function saveHabits(list) {
  try {
    wx.setStorageSync(HABITS_KEY, list)
    return true
  } catch (e) {
    return false
  }
}

function loadRecords() {
  try {
    return wx.getStorageSync(RECORDS_KEY) || {}
  } catch (e) {
    return {}
  }
}

function saveRecords(r) {
  try {
    wx.setStorageSync(RECORDS_KEY, r)
  } catch (e) {
    /* 存储失败静默 —— 打卡不该因为存储问题中断用户操作 */
  }
}

/**
 * 首次打开时铺一套示例数据：几个习惯 + 一段打卡记录。
 *
 * 习惯清单来自 presets.js 的 SEED_NAMES —— 学习/工作/健身/生活四类各挑一两条，
 * 覆盖到但别塞太多（十几条一上来就要用户删，反而劝退）。
 * 想要更多可以去「习惯」页的推荐区加。
 *
 * 记录也要铺：只给空习惯的话，首屏是三条零、热力图全空、成就墙全锁着，
 * 用户看不出这个 app 在干什么。
 *
 * ⚠️ **记录是示例数据，不是用户真做过的**，界面上有说明（见统计页）。
 *
 * 两个判据分开，是为了照顾「之前打开过、已经有习惯」的用户：
 *   习惯 —— 一条都没有才播种
 *   记录 —— **一条都没有**才铺
 * 已经打过卡的人不会被灌进假历史。
 */
function ensureSeed() {
  let list = loadHabits()

  if (!list.length) {
    list = presets.seedHabits().map(function (p, i) {
      return {
        id: 'h' + Date.now() + i,
        name: p.name,
        icon: p.icon,
        color: p.color,
        createdAt: ''
      }
    })
    saveHabits(list)
  }

  const records = loadRecords()
  if (!Object.keys(records).length && list.length) {
    const today = new Date()

    list.forEach(function (h, i) {
      // 习惯可能多于预设的六种（用户自己加过），那就循环用这些节奏
      const offsets = presets.SEED_RECORDS[i % presets.SEED_RECORDS.length] || []
      const rec = {}
      offsets.forEach(function (o) {
        rec[hb.dateKey(hb.shiftDays(today, -o))] = true
      })
      records[h.id] = rec
    })

    saveRecords(records)
  }

  return list
}

function addHabit(name, icon, color) {
  const list = loadHabits()
  const id = 'h' + Date.now() + Math.floor(Math.random() * 1000)
  list.push({
    id: id,
    name: name,
    icon: icon || ICONS[list.length % ICONS.length],
    color: color || COLORS[list.length % COLORS.length],
    createdAt: ''
  })
  saveHabits(list)
  return id
}

function removeHabit(id) {
  const list = loadHabits().filter(function (h) { return h.id !== id })
  saveHabits(list)

  // 记录也一起删掉 —— 不然会一直占着存储，而且用户重建同名习惯时
  // 可能被旧记录「继承」了连续天数，那是个很怪的 bug
  const r = loadRecords()
  delete r[id]
  saveRecords(r)
}

function getRecord(habitId) {
  const r = loadRecords()
  return r[habitId] || {}
}

function isDone(habitId, dateKeyStr) {
  return !!getRecord(habitId)[dateKeyStr]
}

/** 打卡 / 取消打卡。返回切换后的状态 */
function toggle(habitId, dateKeyStr) {
  const r = loadRecords()
  const rec = r[habitId] || {}
  const now = !rec[dateKeyStr]
  if (now) rec[dateKeyStr] = true
  else delete rec[dateKeyStr]
  r[habitId] = rec
  saveRecords(r)
  return now
}

/** 今天所有习惯的完成情况 */
function todayBoard(dateKeyStr) {
  const habits = loadHabits()
  return habits.map(function (h) {
    return {
      id: h.id,
      name: h.name,
      icon: h.icon,
      color: h.color,
      done: !!getRecord(h.id)[dateKeyStr]
    }
  })
}

function iconAt(i) { return ICONS[i % ICONS.length] }
function colorAt(i) { return COLORS[i % COLORS.length] }

// ── 成就解锁记录 ────────────────────────────────────
//
// 存 { 成就id: 'YYYY-MM-DD' }。
//
// 为什么不每次从记录里重算：指标是派生出来的，删掉一个习惯会让
// 「累计打卡次数」回落，纯派生的话已经拿到的成就会退回未解锁 ——
// 明明做到过却显示没做到。所以一旦达成写下来，就永久保留。

function loadUnlocks() {
  try {
    const u = wx.getStorageSync(UNLOCKS_KEY)
    return u && typeof u === 'object' ? u : {}
  } catch (e) {
    return {}
  }
}

function saveUnlocks(u) {
  try {
    wx.setStorageSync(UNLOCKS_KEY, u)
    return true
  } catch (e) {
    return false
  }
}

/**
 * 把新达成的成就记下来，**已经记过的不再动**（日期保持首次达成那天）。
 * 返回是否写入了新内容。
 *
 * 日期传的是「今天」——也就是 App 发现它的那天，不等于真正达成的那天
 *（那几天没打开小程序就会偏）。界面上措辞用「达成于」而不是「完成于」。
 */
function recordUnlocks(evaluated, dateKeyStr) {
  const unlocks = loadUnlocks()
  let changed = false

  ;(evaluated || []).forEach(function (a) {
    if (a.unlocked && !unlocks[a.id]) {
      unlocks[a.id] = dateKeyStr
      changed = true
    }
  })

  if (changed) saveUnlocks(unlocks)
  return changed
}

module.exports = {
  ICONS: ICONS,
  COLORS: COLORS,
  iconAt: iconAt,
  colorAt: colorAt,
  ensureSeed: ensureSeed,
  loadHabits: loadHabits,
  addHabit: addHabit,
  removeHabit: removeHabit,
  getRecord: getRecord,
  isDone: isDone,
  toggle: toggle,
  todayBoard: todayBoard,
  loadUnlocks: loadUnlocks,
  recordUnlocks: recordUnlocks
}
