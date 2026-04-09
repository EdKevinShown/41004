# NSW Council DA Transparency Dashboard

## 1) 项目名称
**NSW Council DA Transparency Dashboard**  
（新南威尔士州 Development Application 透明度对比看板）

## 2) 项目目的
本项目用于对比多个 NSW council 在开发申请（DA）信息公开方面的表现，重点关注：
- 状态信息是否清晰可见
- 文档是否可获取且可追踪
- 进度信息是否对公众透明

项目目标是提供一个适合作业展示与 client demo 的对比型分析仪表盘，而非官方评级系统。

## 3) 数据来源（12 个 councils CSV）
项目使用同一目录下的 12 份 council CSV 数据：
- `Burwood_Council.csv`
- `Campbelltown_City_Council.csv`
- `City_of_Parramatta_Council.csv`
- `Council_of_the_City_of_Sydney.csv`
- `Georges River.csv`
- `Inner_West_Council.csv`
- `Liverpool_City_Council.csv`
- `North Sydney.csv`
- `Ryde_City_Council.csv`
- `Sutherland Shire.csv`
- `The_Council_of_the_Municipality_of_Hunters_Hill.csv`
- `Willoughby_City_Council.csv`

## 4) 数据标准化说明
由于各 council 来源字段命名与格式不完全一致，项目先进行标准化再进入 dashboard 展示。

统一后的字段结构：
- `council`
- `application_no`
- `address`
- `development_type`
- `description`
- `lodged_date`
- `decision`
- `decision_date`
- `has_progress_info`
- `has_documents`
- `status_clarity_score`
- `document_completeness_score`
- `update_visibility_score`
- `navigation_ease_score`
- `notes`

主要标准化规则：
- 日期统一为 `YYYY-MM-DD`
- `Yes/No` 统一为 `boolean`
- `decision` 保留原始语义，仅将 `Application Approved` 归一为 `Approved`
- 保留原始 `notes`

标准化结果输出为：`normalized-records.json`。

### Source vs transformed fields（重要）
- 本项目在展示层使用的 transparency-related scores（`status_clarity_score`、`document_completeness_score`、`update_visibility_score`、`navigation_ease_score`）不应被解读为“官方原生评分体系”。
- 在当前数据快照中，部分 council 的分数字段出现在 CSV 中；但这并不自动意味着该分数是 portal 原生发布且长期稳定可得。
- 在历史版本或其他来源结构中，这些字段可能为缺失/空值（null），或需要依据可见页面证据按统一 rubric 补充编码后再进入对比分析。
- 因此，dashboard 中的分数应理解为“用于横向比较的分析型指标”，而非直接等同于官方业务字段。

## 5) Dashboard 页面组成
前端位于 `frontend/`，核心页面如下：

1. **Overview**
   - 全局案例规模与主要 decision 分布
   - 文档与进度可见率
   - Key Findings Preview 与解释性说明

2. **Council Comparison**
   - council 级别案例量、文档/进度比例、透明度相关评分均值
   - 支持按案例数或平均 transparency score 排序
   - 卡片摘要 + 表格对比

3. **Charts**
   - Document availability by council
   - Progress visibility by council
   - Average transparency score by council
   - Decision distribution by council

4. **Case Explorer**
   - 全量案例查询与筛选
   - 点击行查看完整详情（含 transparency-related scores 与 notes）

## 6) 评分说明（Scoring Note）
所有 transparency-related scores 均采用统一的 **0-2** 量表：
- **0** = not visible / unavailable
- **1** = partially visible / limited
- **2** = clearly visible / well surfaced

这些分数由跨 council 共用的 rubric 进行编码，部分指标依据门户页面可见证据与截图进行人工判定。  
它们属于用于横向比较的分析型指标，不代表官方 council 绩效评级，也不应被表述为“所有来源都原生提供的完整评分字段”。

## 7) 如何运行项目
### A. 生成标准化数据（根目录）
```bash
npm install
npm run dev
```
执行后会生成 `normalized-records.json`。

### B. 启动 dashboard（frontend）
```bash
cd frontend
npm install
npm run dev
```
前端通过 `public/normalized-records.json` 读取数据。  
若更新数据，请先在根目录重新生成，再同步到 `frontend/public/normalized-records.json`。

## 8) 当前局限性
- 不同 council portal 的 schema、页面结构和公开路径并不一致，跨 council 对比存在天然异构性。
- 部分指标依赖页面可见证据与人工 rubric 编码，不完全等同于原生结构化字段。
- 对于历史上出现过缺失/空值（null）的分数字段，当前展示值可能来自后续补充编码或数据版本更新，需与来源版本一并解读。
- 评分差异可能同时反映“实际透明度差异”与“信息呈现方式差异”，解读时应结合来源结构进行判断。
- 个别记录可能存在时间先后异常（如 `decision_date` 早于 `lodged_date`），本项目会审计标记，但不自动改写原值。
- 当前版本以桌面端展示和作业演示为主，尚未覆盖更深入统计建模。

## Suggested Submission Materials

### 1) 推荐截图清单
- **Overview 页面全屏**：展示项目目标、核心指标、Key Findings Preview。
- **Council Comparison 页面**：展示 council 卡片摘要与排序后的对比表格。
- **Charts 页面（4 张图）**：每张图至少截一张完整视图。
- **Case Explorer 页面**：一张筛选后的表格截图 + 一张详情 modal 截图。

### 2) 推荐 presentation 顺序（10 分钟）
1. **第 1 分钟：项目背景与目标**  
   说明为什么要比较 council 透明度，以及本项目关注的三个维度（状态、文档、进度）。
2. **第 2-3 分钟：数据来源与标准化**  
   简述 12 个 CSV、统一 schema 和标准化原则（日期、布尔、decision 口径）。
3. **第 4-5 分钟：Overview 关键发现**  
   先讲总体规模，再讲 documents/progress 的整体覆盖率和初步发现。
4. **第 6-7 分钟：Council Comparison + Charts**  
   聚焦 council 差异，强调透明度与信息可见性并不均衡。
5. **第 8-9 分钟：Case Explorer**  
   展示如何按条件检索并查看单条案例完整信息。
6. **第 10 分钟：局限性与后续改进**  
   说明数据缺失/口径差异问题，并给出后续优化方向。

### 3) 简短口头讲解提纲（适合作业 presentation）
- 本项目基于真实 council DA 数据，目标是做透明度对比，而不是只做页面展示。  
- 我先完成数据审计与标准化，再用统一后的数据驱动 dashboard。  
- 在可视化结果中，可以看到不同 council 在文档可用性和进度可见性上的明显差异。  
- Case Explorer 支持从宏观对比回到单个案例，帮助解释具体记录差异。  
- 当前结果能支持初步比较，后续可加入更细分的时间序列与统计分析。  

### 4) 每张图/页面最适合讲什么
- **Overview**：讲“全局结论”和项目价值，适合作为开场。  
- **Council Comparison**：讲“谁表现更好/更弱”，强调横向比较。  
- **Charts - Document Availability**：讲文档公开程度差异。  
- **Charts - Progress Visibility**：讲流程透明度差异。  
- **Charts - Average Transparency Score**：讲综合评分层面的差异。  
- **Charts - Decision Distribution**：讲不同 council 的案件结果结构差异。  
- **Case Explorer**：讲“如何落到单条证据”，支持结论可追溯。  

