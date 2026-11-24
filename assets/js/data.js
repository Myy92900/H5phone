/* 同源共响 · 词库
 * 说明：故事为团队撰写的演示文本，非田野采集；正式版替换为受访者确认稿。
 * 首版 3 组：1 组同源异形词（日头）+ 2 组同源异读词（期/微）。
 * audio 已接入生成音频（机器合成，非真人田野录音）：每组两岸各 2 位讲述者，各有自己的音轨。
 * voices[0] 为点进来默认播放的音频，voices[1] 为点“换声音”后播放的音频（-alt 文件）。
 * 音频加载失败时自动回退到浏览器语音合成；ttsSpeak 用同音字引导台湾侧读音。
 */
window.SAME_ORIGIN = {
  title: "同源共响",
  subtitle: "两岸同源词汇声音叙事",
  edition: "互动 H5 · 30 秒体验版",
  pairs: [
    {
      id: "taiyang",
      no: "01",
      type: "同源异形词",
      typeKey: "form",
      typeNote: "同一个“日”，走出两种双音化",
      sourceChar: "日",
      sourceTitle: "日 · 太阳",
      sourceNote: "甲骨文“日”像太阳的轮廓。两岸都把“日”留在日常里，只是双音化的路不同：一边长成“太阳”，一边长成“日头”。",
      shared: "共同语素「日」",
      route: "大陆：太（表极致）+ 日 → 太阳；台湾：日 + 头（名词词尾）→ 日头。",
      etymology: "“日”是汉语最古老的核心词之一，甲骨文中以圆形轮廓和中间一点表示太阳。汉语双音化进程中，大陆通用语选择“太 + 日”的偏正结构，台湾国语口语保留“日 + 头”的附加式结构。两个词的核心语素完全同源，差别只在双音化的路径。",
      citations: [
        "《汉语大词典》第 2 版第 5 卷，P1276",
        "《两岸常用词典》，P1032",
        "《汉语词汇史》，P189"
      ],
      mainland: {
        region: "大陆",
        lang: "普通话",
        display: "太阳",
        text: "太阳",
        script: "简体",
        pinyin: "tài yáng",
        voices: [
          {
            tag: "演示 · 青年 · 在校学生",
            place: "福建 · 厦门",
            avatar: "青",
            quote: "小时候放学，奶奶总说'太阳落山前回家'。",
            story: "她年轻时在田里看太阳看时间。现在我在城里上学，傍晚看见太阳，还是会想起她那句话。",
            storyStatus: "演示文本 · 非田野采集",
            audio: "assets/audio/taiyang-cn.mp3",
            ttsText: "太阳"
          },
          {
            tag: "演示 · 中年 · 公交司机",
            place: "河北 · 石家庄",
            avatar: "中",
            quote: "夏天下午三四点，太阳还毒得很，我就把遮阳板放下来。",
            story: "开了十几年车，太阳在哪个季节照进哪一排座位，我大概都知道。",
            storyStatus: "演示文本 · 非田野采集",
            audio: "assets/audio/taiyang-cn-alt.mp3",
            ttsText: "太阳"
          }
        ]
      },
      taiwan: {
        region: "台湾",
        lang: "国语",
        display: "日頭",
        text: "日头",
        script: "繁体",
        pinyin: "rì tóu",
        zhuyin: "ㄖˋ ㄊㄡˊ",
        pronNote: "“日头”是台湾国语口语高频词，带闽南语底色，但已被台湾国语吸收，并非纯闽南语词；此处按国语口语处理。",
        voices: [
          {
            tag: "演示 · 中年 · 小吃店店主",
            place: "台南",
            avatar: "中",
            quote: "我们这里都说“日头”。日头赤炎炎，骑机车出门，眼睛都睁不开。",
            story: "店门口那棵榕树，下午刚好把日头挡住，客人就喜欢坐在树下吃一碗。",
            storyStatus: "演示文本 · 非田野采集",
            audio: "assets/audio/taiyang-tw.mp3",
            ttsText: "日头"
          },
          {
            tag: "演示 · 青年 · 社区志工",
            place: "高雄",
            avatar: "青",
            quote: "日头一下山，巷子里的风就凉了，大家才慢慢搬椅子出来。",
            story: "谁家的孩子回来了，谁家的花开了，都是在这个时候听见的。",
            storyStatus: "演示文本 · 非田野采集",
            audio: "assets/audio/taiyang-tw-alt.mp3",
            ttsText: "日头"
          }
        ]
      }
    },
    {
      id: "qi",
      no: "02",
      type: "同源异读词",
      typeKey: "sound",
      typeNote: "同一个“期”，两种标准音",
      sourceChar: "期",
      sourceTitle: "期 · 约定之时",
      sourceNote: "“期”两岸写法相同，读法却分了家：大陆阴平 qī，台湾阳平 qí。中古群母浊平，一路统读阴平，一路依次浊规律变阳平。",
      shared: "同字「期」· 同源异读",
      route: "中古“期”渠之切（群母浊平）→ 大陆审音统读 qī（阴平）；台湾依次浊规律读 qí（阳平）。",
      etymology: "“期”中古属之韵群母浊平，反切渠之切。大陆《普通话异读词审音表》统读阴平 qī；台湾国语依浊平变阳平的规律读 qí。两音同出一源，是审音取舍之别，不是对错。",
      citations: [
        "《广韵》之韵渠之切",
        "《普通话异读词审音表》（2016）",
        "台湾《国语辞典》"
      ],
      mainland: {
        region: "大陆",
        lang: "普通话",
        display: "期",
        text: "期",
        script: "普通话",
        pinyin: "qī",
        voices: [
          {
            tag: "演示 · 青年 · 大学生",
            place: "北京",
            avatar: "青",
            quote: "这周期中考排得满满的，图书馆从早坐到晚。",
            story: "期中考一结束我就买了回家的票，想好好睡一觉。",
            storyStatus: "演示文本 · 非田野采集",
            audio: "assets/audio/qi-cn.mp3",
            ttsText: "期"
          },
          {
            tag: "演示 · 中年 · 编辑",
            place: "上海",
            avatar: "中",
            quote: "这期的稿子终于排完了，期限就在这周五。",
            story: "赶完这一期，我打算带家人出去吃顿好的，歇口气。",
            storyStatus: "演示文本 · 非田野采集",
            audio: "assets/audio/qi-cn-alt.mp3",
            ttsText: "期"
          }
        ]
      },
      taiwan: {
        region: "台湾",
        lang: "国语",
        display: "期",
        text: "期",
        script: "国语",
        pinyin: "qí",
        zhuyin: "ㄑㄧˊ",
        ttsSpeak: "其",
        pronNote: "台湾标准音读 qí（ㄑㄧˊ）。本机合成声若以同音字引导读音，听感为准；正式版以真人录音与注音示范为准。",
        voices: [
          {
            tag: "演示 · 中年 · 老师",
            place: "台北",
            avatar: "中",
            quote: "期中考快到了，我今晚得把考卷都改完。",
            story: "改完这批考卷，终于能早点回家陪陪孩子了。",
            storyStatus: "演示文本 · 非田野采集",
            audio: "assets/audio/qi-tw.mp3",
            ttsText: "期"
          },
          {
            tag: "演示 · 青年 · 研究生",
            place: "台中",
            avatar: "青",
            quote: "很期待下个月的假期，早就跟朋友约好去花莲了。",
            story: "这段时间天天泡实验室，难得能休几天，我特别期待。",
            storyStatus: "演示文本 · 非田野采集",
            audio: "assets/audio/qi-tw-alt.mp3",
            ttsText: "期"
          }
        ]
      }
    },
    {
      id: "wei",
      no: "03",
      type: "同源异读词",
      typeKey: "sound",
      typeNote: "同一个“微”，两种标准音",
      sourceChar: "微",
      sourceTitle: "微 · 细小之意",
      sourceNote: "“微”两岸写法相同，读音一阴平一阳平。中古次浊平声，大陆统读阴平 wēi，台湾读阳平 wéi。",
      shared: "同字「微」· 同源异读",
      route: "中古“微”无非切（次浊平声）→ 大陆审音统读 wēi（阴平）；台湾读 wéi（阳平）。",
      etymology: "“微”中古属微韵次浊平声，反切无非切。大陆依审音统读阴平 wēi；台湾国语沿用次浊平声读阳平 wéi。音异而字同，来源一致。",
      citations: [
        "《广韵》微韵无非切",
        "《普通话异读词审音表》（2016）",
        "台湾《国语辞典》"
      ],
      mainland: {
        region: "大陆",
        lang: "普通话",
        display: "微",
        text: "微",
        script: "普通话",
        pinyin: "wēi",
        voices: [
          {
            tag: "演示 · 青年 · 程序员",
            place: "深圳",
            avatar: "青",
            quote: "微信上客户又催了，我今晚得把这个版本赶出来。",
            story: "忙着改需求，一抬头都凌晨了，泡面都凉透了。",
            storyStatus: "演示文本 · 非田野采集",
            audio: "assets/audio/wei-cn.mp3",
            ttsText: "微"
          },
          {
            tag: "演示 · 中年 · 医生",
            place: "广州",
            avatar: "中",
            quote: "这点细微的变化可得盯着，病人这几天情况不太稳。",
            story: "值了一整夜的班，天亮时看见了报告，总算松了口气。",
            storyStatus: "演示文本 · 非田野采集",
            audio: "assets/audio/wei-cn-alt.mp3",
            ttsText: "微"
          }
        ]
      },
      taiwan: {
        region: "台湾",
        lang: "国语",
        display: "微",
        text: "微",
        script: "国语",
        pinyin: "wéi",
        zhuyin: "ㄨㄟˊ",
        ttsSpeak: "围",
        pronNote: "台湾标准音读 wéi（ㄨㄟˊ）。本机合成声若以同音字引导读音，听感为准；正式版以真人录音与注音示范为准。",
        voices: [
          {
            tag: "演示 · 中年 · 咖啡师",
            place: "台北",
            avatar: "中",
            quote: "客人发微信来说晚点到，我先帮他把位置留着。",
            story: "这杯手冲我多等了半分钟，客人一来刚好能喝。",
            storyStatus: "演示文本 · 非田野采集",
            audio: "assets/audio/wei-tw.mp3",
            ttsText: "微"
          },
          {
            tag: "演示 · 青年 · 设计师",
            place: "台南",
            avatar: "青",
            quote: "这张图我稍微改了一下颜色，客户说这版就对了。",
            story: "改了十几稿终于定案，我赶紧存档，怕又来一个新需求。",
            storyStatus: "演示文本 · 非田野采集",
            audio: "assets/audio/wei-tw-alt.mp3",
            ttsText: "微"
          }
        ]
      }
    }
  ]
};
