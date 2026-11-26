export function formatIssueStatus(status?: string | null) {
  switch (status) {
    case 'draft':
      return '草稿';
    case 'confirmed':
      return '已确认';
    case 'issued':
      return '已发放';
    default:
      return status || '-';
  }
}

export function formatNotificationType(type?: string | null) {
  switch (type) {
    case 'benefit_issued':
      return '福利到账';
    case 'benefit_balance_changed':
      return '余额变动';
    case 'benefit_expiring_30d':
      return '30天后到期';
    case 'benefit_expiring_15d':
      return '15天后到期';
    case 'benefit_expiring_7d':
      return '7天后到期';
    case 'benefit_expiring_3d':
      return '3天后到期';
    case 'benefit_expiring_1d':
      return '1天后到期';
    case 'benefit_expired':
      return '已过期';
    default:
      return type || '-';
  }
}

export function formatCardRecordStatus(status?: string | null) {
  switch (status) {
    case 'active':
      return '生效中';
    case 'expired':
      return '已过期';
    case 'consumed':
      return '已用完';
    default:
      return status || '-';
  }
}

export function issueStatusTagType(status?: string | null) {
  switch (status) {
    case 'issued':
      return 'success';
    case 'confirmed':
      return 'warning';
    case 'draft':
      return 'info';
    default:
      return 'info';
  }
}

export function notificationTagType(type?: string | null) {
  if (type === 'benefit_issued' || type === 'benefit_balance_changed') {
    return 'success';
  }
  if (type === 'benefit_expired') {
    return 'danger';
  }
  return 'warning';
}
