---
layout: post
title: 资产体系设计
date: 2019/12/16
original: true
tags: [index, design]
---

### 资产平台
##### 资产平台是由滴滴两轮车B端各资产管理、运营系统沉淀出来的一套业务中台系统。正如名字所表示的，该平台主要服务与资产管理，包括但不限于资产模型定义、资产接入、资产关系管理、资产生命周期定义与管理。资产平台的目的是能够通过配置化或者少量的代码开发，快速得承接各种类型的资产业务。
![资产平台结构设计](/img/note/design/assetSystemDesign.png)

### 资产档案中心
##### 资产档案中心是资产平台的下游服务，记录资产平台（不限于）业务操作日志，以及档案视角的全量资产信息。同时具备资产指标定义和指标处理能力，帮助业务更方便、快速、清晰的看清资产现状。
![资产平台结构设计](/img/note/design/assetSystemDesign6.png)

## 资产平台
### 模块说明
#### 1、资产描述
##### 资产平台接入新资产时创建，由mis页面编辑
![资产平台结构设计](/img/note/design/assetSystemDesign1.png)

#### 2、资产描述
#### 平台自带静态属性
* 城市
* 标签（标签内容自定义）

#### 自定义静态属性、类似枚举
* 车型
* 锁型

##### 静态属性通过交互界面管理，业务系统通过接口获取，类似于configcenter

#### 3、资产属性元信息
##### 对资产的各个字段的描述信息，关系到资产属性的生成和校验逻辑
![资产平台结构设计](/img/note/design/assetSystemDesign2.png)

#### 4、资产属性来源
##### 记录资产属性的生成过程、以及确定校验逻辑
##### 资产平台业务的扩展和完善，本质上是对资产属性来源的丰富和完善
![资产平台结构设计](/img/note/design/assetSystemDesign3.png)

#### 5、健康监控
##### 记录资产运行的业务、系统、健康状况
##### 作用：
1. mis资产业务状况一览
2. 资产健康状况一览
3. 资产数据存储迁移依据
4. 资产系统优化依据

#### 6、资产统计
##### 按照资产属性的统计类型，离线计算或流计算资产数据情况

#### 7、编码生成
##### 按照资产编码选择的生成规则生成资产唯一编码。单独提供编码接口或者资产创建时自动生成
* 长度控制
* 是否有序
* 编码组合

#### 8、操作类型
1. 资产系统在自己的业务系统中定义，在操作中携带，资产平台不做校验、只做记录
2. 在资产平台中添加操作记录，在资产操作中携带，可以附带以下逻辑
    1. 按照操作类型记录资产生命周期
    2. 绑定特殊逻辑，比如标签逻辑、归属城市逻辑

#### 9、查询模板
##### 定义一次查询返回的资产属性字段，可以是单个资产的部分属性，也可以是多个资产组合而成的属性
##### 生成模板编号
![资产平台结构设计](/img/note/design/assetSystemDesign4.png)

### 存储容器
![资产平台结构设计](/img/note/design/assetSystemDesign5.png)

### 数据迁移流程
##### 原系统情况，多个资产系统共用一套数据源，原资产模型存在诸多不合理之处。
![资产平台结构设计](/img/note/design/assetSystemDesign7.png)

##### 数据源与系统迁移流程
![资产平台结构设计](/img/note/design/assetSystemDesign8.png)

### 分布式数据一致性方案
#### 方案一（通过事务管理，关联运营事务与资产事务）
![资产平台结构设计](/img/note/design/assetSystemDesign9.png)

#### 方案二（通过sdk包装，保持运营事务与资产事务粒度一致）
![资产平台结构设计](/img/note/design/assetSystemDesign10.png)

## 资产档案中心

### 数据收集、实时计算模块
![资产平台结构设计](/img/note/design/assetSystemDesign11.png)
* 触发层：指标变更的触发事件，包含事件本身以及事件内容
* 适配层：基于已有业务，让业务方按照我们的事件模型定义属性不太现实，这里使用适配层转换成档案中心统一模型
* 流模型：对事件流的描述信息，数据来源
* 档案模型：对档案中心的数据描述，大致有资产基本信息、资产指标、资产日志（生命周期）。基于各种档案类型，分别抽象档案模型，以及对具体的档案模型实现执行接口；
* 模型转换：本质上是将流模型 → 档案模型，并调用具体的档案变更接口中间的处理过程。

### 示例：
#### 事件说明：一次路面签收动作，涉及资产档案中心3个具体档案变动：
1. 资产状态变更（资产基本信息）
2. 城市投放车辆增加（指标）
3. 资产生命周期记录（日志）

#### 档案模型定义：
##### 档案基础模型：
```java
/**
 * @author wangwenxiang@didiglobal.com
 * 档案
 */
public interface Record {
 
    /**
     * 资产类型
     */
    int assetType();
 
    /**
     * 数据源
     */
    DataSource dataSource();
 
}
```
##### 基础信息类档案：
```java
/**
 * @author wangwenxiang@didiglobal.com
 * 基本信息类 档案
 * C 资产对象标识
 * T 档案属性
 */
public interface AssetInfoRecord<C, T> extends Record{

    /**
     * 查询
     */
    T query(C c);

    /**
     * 变更
     */
    boolean update(List<C> cList, T t);

}
```
##### 指标类档案：
```java
/**
 * @author wangwenxiang@didiglobal.com
 * 基本信息类 档案
 * C 指标
 * T 档案属性
 */
public interface IndexRecord<C, T> extends Record{

    /**
     * 查询
     */
    T query(C c);

    /**
     * 指标添加
     */
    boolean insert(List<C> cList, T t);

    /**
     * 指标覆盖
     */
    boolean cover(List<C> cList, T t);

}
```
##### 日志类型档案：
```java
/**
 * @author wangwenxiang@didiglobal.com
 * 基本信息类 档案
 * C 查询条件
 * T 日志
 */
public interface LogRecord<C, T> extends Record{

    /**
     * 查询
     */
    List<T> query(C c);

    /**
     * 日志记录
     */
    boolean logRecord(T t);

}
```
#### 流模型定义：
* 资产信息：车辆id
* 上下文信息：时间、地点、运维人员、资产快照
* 操作变更：状态变更后值

#### 模型转换规则：
##### 因为该事件导致3个档案信息发生变化，因此绑定3个规则，每个规则在生成的时候需要绑定档案模型以及具体变更方法：

##### 1、签收导致状态变更规则：
* 绑定方法：AssetInfoRecord.update
* 对象计算：根据流模型的资产信息，找到具体车辆id
* 结果量计算：根据流模型的操作变更信息：状态变更结果值

##### 2、城市投放车辆增加
* 绑定方法：IndexRecord.insert
* 对象计算：根据流模型的上下文信息，找到车型信息和城市信息
* 结果量计算：根据资产信息：计算车辆数量

##### 3、资产生命周期记录
* 绑定方法：LogRecord.logRecord
* 对象计算：根据流模型的上下文信息，找到资产类型
* 结果量计算：将流模型转换成资产生命周期模型

![资产平台结构设计](/img/note/design/assetSystemDesign12.png)