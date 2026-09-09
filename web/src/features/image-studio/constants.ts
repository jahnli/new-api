import type { PromptPreset } from './types'

export const API_ENDPOINTS = {
  IMAGE_GENERATIONS: '/pg/images/generations',
  IMAGE_EDITS: '/pg/images/edits',
  IMAGE_ASSETS: '/api/image-studio/assets',
  IMAGE_STUDIO_GENERATIONS: '/api/image-studio/generations',
  USER_MODELS: '/api/user/models',
  USER_GROUPS: '/api/user/self/groups',
} as const

export const DEFAULT_GROUP = 'default' as const

export const DEFAULT_IMAGE_MODEL = 'gpt-image-2' as const

export const CUSTOM_SIZE = 'custom' as const

/** fallback estimate (ms) when no local history exists for the model */
export const DEFAULT_ESTIMATE_MS = 60000

/** number of recent generations used for the moving-average estimate */
export const ESTIMATE_SAMPLE_SIZE = 5

export const DEFAULT_HISTORY_DISPLAY_LIMIT = 20

/**
 * Built-in prompt presets. Category names are i18n keys; prompts are
 * sent to the model as-is (English works best across providers).
 */
export const PROMPT_PRESETS: PromptPreset[] = [
  {
    category: '赛美特 AI 智能制造',
    prompts: [
      '赛美特 AI 智能制造软件解决方案高端主视觉，未来工业指挥中心连接半导体晶圆厂、光伏工厂、电池产线和流程化工工厂，发光数据流贯穿全场，蓝白企业科技风，照片级真实感，超高清细节',
      'AI 驱动的智能制造平台，将代码和数据转化为精密数字工厂，MES、EAP、YMS、SPC、FDC、RPA 模块的软件界面悬浮在产线上方，干净高级的企业科技视觉，蓝色渐变光效，电影感构图',
      'AI 驱动价值的高科技制造管理驾驶舱，实时展示生产质量、设备健康、排程计划、良率分析等全息面板，背景为现代化智能工厂车间，专业 B2B 软件营销风格',
      '以软件成就智造的抽象视觉表达，代码流逐渐组成机械臂、生产线、晶圆、太阳能电池片和电池模组，数字化转型概念，优雅蓝银配色，现代企业宣传海报风格',
      '赛美特 AI 工业智能体主视觉，多个智能体分别负责排程优化、质量预测、设备诊断、能耗分析和异常处置，围绕数字工厂中枢协同运转，蓝白色高端 SaaS 产品视觉',
      '高端智能制造软件发布会背景图，巨大的透明数字工厂悬浮在舞台中央，MES、EAP、YMS、AMS、TMS、WFA、MCS 数据模块以环形界面展开，企业蓝科技风，宽屏海报构图',
      'AI 赋能先进制造的品牌宣传图，工程师站在全息工厂沙盘前查看生产瓶颈、良率趋势和设备稼动率，真实工业场景与未来数字界面融合，明亮高级质感',
      '工业 AI 数据治理平台视觉，来自设备、工艺、质量、物流和能源系统的数据汇聚成统一知识图谱，节点发光连接智能工厂全域，深蓝背景，精密科技感',
      '智能制造一体化平台首页 Banner，左侧为简洁软件仪表盘，右侧为高度自动化工厂产线，数据流从软件界面流向机械设备，企业级产品官网风格',
      '全球多工厂智能运营中心，大屏同时监控中国、东南亚、欧洲多个工厂的产能、质量和交付状态，AI 自动给出调度建议，蓝色数字孪生地图，超宽屏构图',
      'AI 质量预测系统主视觉，产品缺陷在发生前被发光预警圈标记，SPC 控制图、良率曲线和设备参数浮现在产线上方，半写实工业科技风格',
      '面向先进制造的低代码工业应用平台，业务人员通过拖拽流程节点搭建工厂应用，数据表单、审批流和设备连接器悬浮展示，干净现代 UI 视觉',
      '智能制造数字底座概念图，数据湖、知识图谱、模型服务、业务应用和工厂设备分层连接，像精密芯片一样组成工业软件架构，蓝银色科技海报',
      'AI 驱动的生产异常闭环管理场景，系统自动发现异常、派发任务、追踪处理进度并沉淀知识库，透明任务看板覆盖在真实工厂画面上，企业级软件宣传风格',
    ],
  },
  {
    category: '先进制造行业场景',
    prompts: [
      '现代半导体晶圆厂洁净室，自动物料搬运系统与精密设备协同运行，工程师监控 MES 和 EAP 看板，AI 优化数据叠加显示，冷蓝色照明，照片级真实工业科技场景',
      '光伏智能工厂正在生产太阳能电池片和组件，自动串焊机与检测设备高速运行，透明屏幕展示 MES 与 SPC 质量数据，融合绿色能源和先进制造氛围',
      '锂电池制造产线，涂布、卷绕、化成设备自动运行，AGV 物流配送与 AI 质量检测协同工作，实时生产调度和 FDC 异常检测看板，电影级工业写实风格',
      '流程化工智能工厂控制中心，操作员通过 AI 软件监控管线、反应釜和能耗数据，大屏展示实时工艺参数，安全智能生产场景，暖色工业照明，高端企业视觉',
      '有色金属智能工厂，自动化铸造设备与高温熔炉运行，AI 视觉质量检测扫描产品，红色熔融金属、银色机械设备与蓝色软件看板形成强烈对比，戏剧化照片级光影',
      '半导体封装测试工厂，晶圆切割、芯片贴装、引线键合和自动测试设备连续运行，AI 系统实时分析良率与测试数据，洁净明亮的先进制造场景',
      '电子组装 SMT 智能产线，高速贴片机、AOI 检测和自动仓储系统协同运行，屏幕展示工单进度、缺陷分布和设备状态，真实工业摄影风格',
      '医疗器械精密制造车间，自动化装配设备生产高端医疗组件，AI 视觉检测确保质量合规，洁净白色环境与蓝色数据界面融合，专业可靠的企业视觉',
      '航空航天零部件智能加工中心，大型五轴机床加工钛合金结构件，数字孪生模型与工艺参数悬浮显示，工程师远程监控设备状态，电影级写实光影',
      '新能源储能工厂，电芯模组装配、BMS 测试和自动化老化线协同运行，实时展示能量密度、测试曲线和安全预警，绿色能源科技视觉',
      '精细化工连续生产装置，管廊、反应釜、传感器和中央控制室通过工业互联网连接，AI 优化工艺参数降低能耗，安全稳定的高端工业画面',
      '黑灯工厂夜间自动生产场景，少量蓝色指示灯照亮机器人、输送线和检测设备，AI 系统无人值守监控全流程，神秘高级的工业科技风格',
      '离散制造多品种小批量柔性产线，机器人快速换型生产不同产品，智能调度系统动态安排生产节拍，透明界面展示订单优先级和资源负载',
      '工业园区级智能制造大脑，多个工厂、仓库、能源站和物流车辆接入同一 AI 调度平台，三维地图上呈现实时产能和碳排数据，宏大科技感',
    ],
  },
  {
    category: '制造软件产品概念',
    prompts: [
      'MES 制造执行系统概念图，中央数字大脑协调智能工厂中的人员、设备、物料、工艺和质量，发光数据线连接各环节，实时生产看板，蓝色企业科技风',
      'EAP 设备自动化系统概念图，半导体设备、机械手和工厂主机系统通过高速数据链路连接，控制指令以发光脉冲形式传递，洁净室科技视觉',
      'YMS 良率管理系统概念图，晶圆、电池片和电子产品的测试数据汇聚成良率地图，AI 自动识别关键损失因子，蓝绿色数据可视化与工业背景融合',
      'APC 先进过程控制系统概念图，AI 根据实时工艺参数自动优化设备控制策略，温度、压力、流量和质量指标在全息控制面板中联动变化，精密制造软件科技风格',
      'SPC 统计过程控制概念图，精密测量数据形成控制图和提前预警信号，AI 在缺陷发生前识别工艺漂移，干净的数据可视化艺术与工业背景结合',
      'FDC 故障检测与分类系统概念图，AI 之眼扫描制造设备运行信号，绿色正常波形与红色异常信号突出显示，深蓝科技背景，锐利的企业软件海报风格',
      '制造运营中的 RPA 机器人流程自动化，软件机器人在工厂系统之间处理订单、报表和流程审批，数字员工与流程节点悬浮在智能制造办公室上方',
      'RTD 实时派工系统概念图，订单、设备、人员和物料约束在三维工厂地图中动态匹配，最优任务路径以发光轨迹呈现，未来工业软件界面风格',
      'WMS 智能仓储管理系统可视化，立体库货位、AGV 路径、批次追溯和库存预警叠加在工厂仓储空间中，整洁企业级产品海报',
      '工业知识库与专家系统概念图，历史异常、工艺规则、设备手册和维修经验被 AI 编织成知识网络，工程师通过自然语言查询解决方案，深蓝科技视觉',
    ],
  },
  {
    category: 'Factory & Manufacturing',
    prompts: [
      'A modern smart factory floor with orange robotic arms assembling products on a conveyor belt, bright industrial lighting, clean high-tech environment, wide angle, photorealistic',
      'Aerial view of a large automated warehouse with AGV robots moving between tall shelves, blue accent lighting, futuristic logistics center, ultra detailed',
      'Engineers in safety helmets monitoring a digital twin dashboard of a production line, large screens with charts, industrial control room, cinematic lighting',
      'Close-up of a precision CNC machine milling a metal part, sparks and coolant mist, shallow depth of field, industrial photography',
    ],
  },
  {
    category: 'Semiconductor & Chips',
    prompts: [
      'Macro photograph of a silicon wafer with iridescent chip dies reflecting rainbow light, cleanroom background, extreme detail, studio lighting',
      'A futuristic semiconductor fab cleanroom with engineers in white bunny suits operating EUV lithography machines, purple and blue lighting, photorealistic',
      'Detailed 3D render of a CPU chip on a circuit board with glowing golden circuit traces, dark background, dramatic tech lighting, isometric view',
      'Nanoscale visualization of transistor structures on a microchip, abstract electron flow as glowing particles, deep blue color palette, scientific illustration style',
    ],
  },
  {
    category: 'Tech Article Illustration',
    prompts: [
      'Minimalist flat illustration of cloud computing concept, servers and data streams connecting devices, soft gradient background, modern editorial style',
      'Abstract isometric illustration of artificial intelligence neural network, interconnected glowing nodes, pastel color scheme, clean vector style for a tech blog header',
      'Conceptual illustration of cybersecurity, a glowing digital shield protecting data blocks, dark navy background with neon accents, editorial illustration',
      'Futuristic illustration of big data analytics, floating holographic charts and dashboards above a laptop, gradient purple-blue palette, modern tech article cover',
    ],
  },
  {
    category: 'IT & Software',
    prompts: [
      'A developer workspace at night with multiple monitors showing colorful code, mechanical keyboard, ambient RGB lighting, cozy tech atmosphere, photorealistic',
      'Isometric illustration of a DevOps pipeline with build, test and deploy stages as a factory assembly line, flat design, blue and teal colors',
      'A modern server room with rows of glowing racks and fiber optic cables, symmetric composition, cool blue tones, cinematic depth',
      'Team of software engineers collaborating around a whiteboard full of system architecture diagrams, bright modern office, candid documentary style',
    ],
  },
]
