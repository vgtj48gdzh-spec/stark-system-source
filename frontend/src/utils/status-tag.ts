export const workOrderStatusMap: Record<string, { label: string; type: string }> = {
  draft: { label: '草稿', type: 'info' },
  pending_payment: { label: '待付款', type: 'warning' },
  paid: { label: '已付款', type: 'success' },
  in_progress: { label: '进行中', type: 'primary' },
  completed: { label: '已完成', type: 'success' },
  closed: { label: '已关闭', type: 'info' },
};

export const approvalStatusMap: Record<string, { label: string; type: string }> = {
  pending: { label: '待审批', type: 'warning' },
  approved: { label: '已通过', type: 'success' },
  rejected: { label: '已拒绝', type: 'danger' },
};

export const paymentStatusMap: Record<string, { label: string; type: string }> = {
  pending: { label: '待确认', type: 'warning' },
  success: { label: '成功', type: 'success' },
  failed: { label: '失败', type: 'danger' },
};

export const warehouseStatusMap: Record<string, { label: string; type: string }> = {
  active: { label: '启用', type: 'success' },
  inactive: { label: '停用', type: 'info' },
};

export const supplierStatusMap: Record<string, { label: string; type: string }> = {
  active: { label: '启用', type: 'success' },
  inactive: { label: '停用', type: 'info' },
};

export const materialStatusMap: Record<string, { label: string; type: string }> = {
  active: { label: '启用', type: 'success' },
  inactive: { label: '停用', type: 'info' },
};

export const inventoryTransactionTypeMap: Record<string, { label: string; type: string }> = {
  inbound: { label: '入库', type: 'success' },
  outbound: { label: '出库', type: 'warning' },
};

export const preparationBindStatusMap: Record<string, { label: string; type: string }> = {
  unbound: { label: '未绑定工单', type: 'warning' },
  bound: { label: '已绑定工单', type: 'success' },
};

export const workOrderMaterialSourceMap: Record<string, { label: string; type: string }> = {
  manual: { label: '手工录入', type: 'info' },
  warehouse: { label: '库房出库', type: 'warning' },
  preparation: { label: '备料绑定', type: 'success' },
};
