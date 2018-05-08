---
layout: post
title: dubbo概述
date: 2018/03/22
tags: [tech, index, dubbo]
tag: [[java, java], [dubbo, dubbo]]
original: true
---

##### 从这篇文章开始，我将对dubbo的源码进行阅读与分析。网络上对于dubbo的架构已经整体的设计原理已经有非常多的文章了，这里推荐一下[dubbo官方技术文档](http://dubbo.io/books/dubbo-dev-book/)。这些文档已经对dubbo的整体架构和扩展机制做了详细的说明。这在我后面的系列文章中将不会再有这部分介绍。但是该文档只是指出了dubbo的众多扩展点的接口以及简单说明，并没有对接口做详细的代码实现分析。所以我将尝试阅读并分享基于这些扩展点的代码实现过程。

<!--more-->

#### 在这之前，我们还是简单介绍一下dubbo的框架设计

## 框架设计
### 整体设计
![](/img/note/dubbo/dubbo-framework.jpg)

##### 图例说明：
* 图中左边淡蓝背景的为服务消费方使用的接口，右边淡绿色背景的为服务提供方使用的接口，位于中轴线上的为双方都用到的接口。
* 图中从下至上分为十层，各层均为单向依赖，右边的黑色箭头代表层之间的依赖关系，每一层都可以剥离上层被复用，其中，Service 和 Config 层为 API，其它各层均为 SPI。
* 图中绿色小块的为扩展接口，蓝色小块为实现类，图中只显示用于关联各层的实现类。
* 图中蓝色虚线为初始化过程，即启动时组装链，红色实线为方法调用过程，即运行时调时链，紫色三角箭头为继承，可以把子类看作父类的同一个节点，线上的文字为调用的方法。

### 各层说明
* **config 配置层**：对外配置接口，以 ServiceConfig, ReferenceConfig 为中心，可以直接初始化配置类，也可以通过 spring 解析配置生成配置类
* **proxy 服务代理层**：服务接口透明代理，生成服务的客户端 Stub 和服务器端 Skeleton, 以 ServiceProxy 为中心，扩展接口为 ProxyFactory
* **registry 注册中心层**：封装服务地址的注册与发现，以服务 URL 为中心，扩展接口为 RegistryFactory, Registry, RegistryService
* **cluster 路由层**：封装多个提供者的路由及负载均衡，并桥接注册中心，以 Invoker 为中心，扩展接口为 Cluster, Directory, Router, LoadBalance
* **monitor 监控层**：RPC 调用次数和调用时间监控，以 Statistics 为中心，扩展接口为 MonitorFactory, Monitor, MonitorService
* **protocol 远程调用层**：封装 RPC 调用，以 Invocation, Result 为中心，扩展接口为 Protocol, Invoker, Exporter
* **exchange 信息交换层**：封装请求响应模式，同步转异步，以 Request, Response 为中心，扩展接口为 Exchanger, ExchangeChannel, ExchangeClient, ExchangeServer
* **transport 网络传输层**：抽象 mina 和 netty 为统一接口，以 Message 为中心，扩展接口为 Channel, Transporter, Client, Server, Codec
* **serialize 数据序列化层**：可复用的一些工具，扩展接口为 Serialization, ObjectInput, ObjectOutput, ThreadPool

### 关系说明
* 在 RPC 中，Protocol 是核心层，也就是只要有 Protocol + Invoker + Exporter 就可以完成非透明的 RPC 调用，然后在 Invoker 的主过程上 Filter 拦截点。
* 图中的 Consumer 和 Provider 是抽象概念，只是想让看图者更直观的了解哪些类分属于客户端与服务器端，不用 Client 和 Server 的原因是 Dubbo 在很多场景下都使用 Provider, Consumer, Registry, Monitor 划分逻辑拓普节点，保持统一概念。
* 而 Cluster 是外围概念，所以 Cluster 的目的是将多个 Invoker 伪装成一个 Invoker，这样其它人只要关注 Protocol 层 Invoker 即可，加上 Cluster 或者去掉 Cluster 对其它层都不会造成影响，因为只有一个提供者时，是不需要 Cluster 的。
* Proxy 层封装了所有接口的透明化代理，而在其它层都以 Invoker 为中心，只有到了暴露给用户使用时，才用 Proxy 将 Invoker 转成接口，或将接口实现转成 Invoker，也就是去掉 Proxy 层 RPC 是可以 Run 的，只是不那么透明，不那么看起来像调本地服务一样调远程服务。
* 而 Remoting 实现是 Dubbo 协议的实现，如果你选择 RMI 协议，整个 Remoting 都不会用上，Remoting 内部再划为 Transport 传输层和 Exchange 信息交换层，Transport 层只负责单向消息传输，是对 Mina, Netty, Grizzly 的抽象，它也可以扩展 UDP 传输，而 Exchange 层是在传输层之上封装了 Request-Response 语义。
* Registry 和 Monitor 实际上不算一层，而是一个独立的节点，只是为了全局概览，用层的方式画在一起。

### 其他
##### 以上摘抄了一部分个人觉得对理解dubbo结构比较重要的部分，当然只看这一部分肯定还是很糊涂的，需要结合各种实际项目以及源码去慢慢理解。除此之外，还有一些比较重要的架构信息：
* dubbo的扩展点机制，dubbo是如何实现模块化的：[dubbo扩展点加载](http://dubbo.io/books/dubbo-dev-book/SPI.html)
* dubbo的整体实现细节，加载入口，服务以及通讯细节：[dubbo实现细节](http://dubbo.io/books/dubbo-dev-book/implementation.html)

##### 其实作为rpc远程调用本身来说，实现是很简单的，只是dubbo在这之上构建了一套完整的基于服务的整体架构，这也是dubbo的魅力所在，那么我后面也将对这些服务做一些详细实现分析：
##### [dubbo-动态代理实现](https://winx402.github.io/note/dubbo/proxy/)
##### [dubbo-负载均衡实现](https://winx402.github.io/note/dubbo/loadBalance/)
##### [本系列dubbo源码分析](https://winx402.github.io/tags/dubbo/)