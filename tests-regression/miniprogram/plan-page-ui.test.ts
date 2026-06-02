import { readFileSync } from 'fs';
import path from 'path';

const planPageDir = path.join(process.cwd(), 'erpxcx', 'pages', 'plan');

function readPlanFile(filename: string) {
  return readFileSync(path.join(planPageDir, filename), 'utf8');
}

describe('小程序报货计划页面', () => {
  test('不展示提交报货单动作和客户联系信息采集', () => {
    const wxml = readPlanFile('index.wxml');
    const js = readPlanFile('index.js');
    const wxss = readPlanFile('index.wxss');

    expect(wxml).not.toContain('提交报货单');
    expect(wxml).not.toContain('客户名称');
    expect(wxml).not.toContain('联系电话');
    expect(wxml).not.toContain('送货地址');
    expect(wxml).not.toContain('整单备注');
    expect(wxml).not.toContain('contact-card');
    expect(wxml).not.toContain('onSubmitGoodsRequestTap');

    expect(js).not.toContain('submitGoodsRequest');
    expect(js).not.toContain('mini_goods_request_contact');
    expect(js).not.toContain('onSubmitGoodsRequestTap');
    expect(js).not.toContain('onContactInput');
    expect(js).not.toContain('customerPhone');
    expect(js).not.toContain('contactAddress');
    expect(js).not.toContain('submitRemarks');

    expect(wxss).not.toContain('.contact-card');
    expect(wxss).not.toContain('.contact-input');
    expect(wxss).not.toContain('.submit-btn');
  });
});
