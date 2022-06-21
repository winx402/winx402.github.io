---
layout: post
title: Aop
date: 2017/06/04
original: true
tags: [tech, river, index, java]
color: '#E30D23'
tag: [[river, river]]
---

##### aop是一个比较典型的例子，aop实现在目标方法之前、之后、异常等情况下的代码插入。这些插入的代码可以做类似于日志记录，流量统计等工作。也可以在before代码中修改目标方法参数，在after中修改目标方法返回值。但是没有办法控制目标方法是否继续（除非抛出异常）。
<!--more-->

### 实例代码
#### 首先需要实现一个继承自`AopPoint`的类。 
```java
public class AopTest extends AopPoint {

    public void before() {
        System.out.println("before....params:" + Arrays.toString(getParams()));
        setParams(new Object[]{"change params"});
    }

    public void after() {
        System.out.println("after...result:" + getResult());
    }

    public void afterReturing() {
    }

    public void afterThrowing() {
    }
}
```
#### 在目标方法中加入`Aop`注解,在Aop注解中设置自己实现的`AopPoint`类Class
```java
@Aop(AopTest.class)
public String aop(String param){
    System.out.println("aop param : " + param);
    return param + " success";
}
```
#### 获取目标方法类的代理实例，然后执行
```java
CrudServiceImpl proxy = ProxyFactory.getSingleProxy(CrudServiceImpl.class);
proxy.aop("test");
```
#### 执行结果
```none
before....params:[test]
aop param : change params
after...result:change params success
```

### 代码分析
#### 继承自`AopPoint`的类,需要实现4个方法：
##### `before`：在目标方法之前执行；
##### `after`：在目标方法之后执行，无论目标执行是否成功；
##### `afterReturing`：在目标方法执行之后执行；
##### `afterThrowing`：在目标方法抛出异常后调用执行。
#### 在`AopPoint`的子类中，设置了一些对目标方法的操作：
```java
/**
 * 获取目标方法Method对象
 */
protected Method getMethod() {}

/**
 * 获取入参
 */
protected Object[] getParams() {}

/**
 * 修改入参
 */
protected void setParams(Object[] objects) {}

/**
 * 获取返回结果
 * 在before中调用这个方法将返回null
 */
protected Object getResult() {}

/**
 * 修改返回结果
 * 在before中设置的返回结果将被正真的结果覆盖
 */
protected void setResult(Object result) {}
```
#### `AopPoint`的实现类会使用单例模式，所以当你Aop多个方法的时候，调用的都是将是同一个实例。因此下面这种代码将会出现线程安全问题
```java
public class AopTest extends AopPoint {

    private int i = 0;

    public void before() {
        System.out.println(++i);
    }

    ...
}
```
##### 这种线程安全问题只能自己保证共享对象的安全。现在还不能通过参数改变aop的实例类是否单例。
```java
public class AopTest extends AopPoint {

    private AtomicInteger i = new AtomicInteger(0);

    public void before() {
        System.out.println(i.incrementAndGet());
    }

    ...
}
```

#### aop大法好，但是也有一些局限性，说一说还能实现的一些细节点：
1. 目前代理对象还是需要手动的去获取，这个在后期接入spring逻辑后，可以使用spring注入。
2. 没有办法做到流程控制，是否可以在`AopPoint`中加入流程控制，当发现参数不对时，阻止流程的继续。
3. 当目标方法比较多时，需要添加注解的地方比较多，这点Spring使用的是切面的解决方法，个人认为这种方法会使得使用的学习成本变高，因为每次我想要使用的时候需要翻看笔记。是否可以使得`Aop`支持类的注解，以减轻这种现象。
4. 是否应该控制`AopPoint`实现类的单例与否。