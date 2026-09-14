import { describe, expect, test } from 'bun:test';
import { toPinyinColumns } from './users.pinyin';

describe('toPinyinColumns', () => {
  test('纯中文姓名生成全拼与首字母', () => {
    expect(toPinyinColumns('王博')).toEqual({ pinyin: 'wangbo', pinyinInitial: 'wb' });
    expect(toPinyinColumns('邵千巡')).toEqual({ pinyin: 'shaoqianxun', pinyinInitial: 'sqx' });
    expect(toPinyinColumns('张三丰')).toEqual({ pinyin: 'zhangsanfeng', pinyinInitial: 'zsf' });
  });

  test('复姓生成全拼与首字母', () => {
    expect(toPinyinColumns('欧阳修')).toEqual({ pinyin: 'ouyangxiu', pinyinInitial: 'oyx' });
  });

  test('ü 映射为 v，输入 lv 能匹配「吕」', () => {
    expect(toPinyinColumns('吕良伟')).toEqual({ pinyin: 'lvliangwei', pinyinInitial: 'llw' });
  });

  test('英文与数字原样保留且归一为小写', () => {
    expect(toPinyinColumns('张伟 ZHANG Wei')).toEqual({
      pinyin: 'zhangwei zhang wei',
      pinyinInitial: 'zw zhang wei',
    });
  });

  test('连续空白归一为单个空格', () => {
    expect(toPinyinColumns(' 张   三 ')).toEqual({ pinyin: 'zhang san', pinyinInitial: 'z s' });
  });
});
