---
layout: post
title: 缓存
date: 2017/06/05
original: true
tags: [tech, river, index]
---

##### 　　cache的功能显而易见，是对目标方法结果的缓存，在缓存结果有效期内，新的调用并不会去执行目标方法，而是直接拿缓存结果。并且用户可以自定义缓存的key（从入参中选取一部分参数，或者是某个对象中的某些属性来作为缓存的key）。
<!--more-->

### 实例代码
#### 目标方法添加`cache`注解
```java
@Cache(maxSize = 2, timeOut = 1, timeUnit = TimeUnit.MINUTES)
public String cache(String param){
    System.out.println("cache param : " + param);
    return param + " success";
}
```
#### 获取代理对象实例，调用目标方法
```java
final CrudServiceImpl proxy = ProxyFactory.getSingleProxy(CrudServiceImpl.class);
for (int i = 0; i < 10; i ++){
    System.out.println(proxy.cache("cache key"));
}
```
#### 执行结果
```none
cache param : cache key
cache key success
cache key success
cache key success
cache key success
cache key success
cache key success
cache key success
cache key success
cache key success
cache key success
```

### 代码分析

#### 缓存大法好，但是也有一些局限性，说一说还能实现的一些细节点：
1. 目前代理对象还是需要手动的去获取，这个在后期接入spring逻辑后，可以使用spring注入。