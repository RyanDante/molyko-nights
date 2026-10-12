const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

export function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
}

export function isValidDate(date: unknown): date is string {
  if (typeof date !== 'string') return false
  const match = DATE_PATTERN.exec(date)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (year < 1 || month < 1 || month > 12) return false
  const monthLength = [
    31,
    isLeapYear(year) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ][month - 1]
  return day >= 1 && day <= monthLength
}

export function nextDate(date: string): string | null {
  if (!isValidDate(date)) return null
  const match = DATE_PATTERN.exec(date)!
  let year = Number(match[1])
  let month = Number(match[2])
  let day = Number(match[3])
  const monthLength = [
    31,
    isLeapYear(year) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ][month - 1]

  if (day < monthLength) {
    day += 1
  } else if (month < 12) {
    month += 1
    day = 1
  } else if (year < 9_999) {
    year += 1
    month = 1
    day = 1
  } else {
    return null
  }

  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function daysBetween(startDate: string, endDate: string): number | null {
  if (!isValidDate(startDate) || !isValidDate(endDate) || endDate < startDate) {
    return null
  }
  const ordinal = (date: string): number => {
    const match = DATE_PATTERN.exec(date)!
    const year = Number(match[1])
    const month = Number(match[2])
    const day = Number(match[3])
    const previousYears = year - 1
    let total = previousYears * 365
      + Math.floor(previousYears / 4)
      - Math.floor(previousYears / 100)
      + Math.floor(previousYears / 400)
    for (let currentMonth = 1; currentMonth < month; currentMonth += 1) {
      total += [
        31,
        isLeapYear(year) ? 29 : 28,
        31,
        30,
        31,
        30,
        31,
        31,
        30,
        31,
        30,
        31,
      ][currentMonth - 1]
    }
    return total + day
  }
  return ordinal(endDate) - ordinal(startDate)
}

export function ageOnDate(birthDate: string, date: string): number | null {
  if (!isValidDate(birthDate) || !isValidDate(date) || date < birthDate) return null
  const birth = DATE_PATTERN.exec(birthDate)!
  const current = DATE_PATTERN.exec(date)!
  const birthYear = Number(birth[1])
  const birthMonth = Number(birth[2])
  const birthDay = Number(birth[3])
  const currentYear = Number(current[1])
  const currentMonth = Number(current[2])
  const currentDay = Number(current[3])
  const celebratedDay = birthMonth === 2 && birthDay === 29
    && !isLeapYear(currentYear)
    ? 28
    : birthDay
  const birthdayPassed = currentMonth > birthMonth
    || (currentMonth === birthMonth && currentDay >= celebratedDay)
  return currentYear - birthYear - (birthdayPassed ? 0 : 1)
}
