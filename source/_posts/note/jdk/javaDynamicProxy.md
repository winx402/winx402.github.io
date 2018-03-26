---
layout: post
title: java动态代理实现
date: 2018/01/08
tags: [tech, index]
original: true
tag: [[java, java]]
---

### 什么是java代理
#### 为其他对象提供一种代理以控制对这个对象的访问。
##### 代理是一种常见的设计模式，通过代理层这一中间层，有效的控制对于真实委托类对象的直接访问，同时可以实现自定义的控制策略，设计上获得更大的灵活性。
<!-- more -->

#### java代理模型
![java代理](/img/note/proxy.png) <div class='img-note'>java代理</div>

### java中常见的的代理实现
1. spring aop (@Transactional)
2. dubbo

### 对目标方法的增强
1. 缓存
2. 流量控制、筛选、统计
3. 线程池
4. 失败重试
5. 权限验证

## 静态代理
##### 实现java代理相对简单的一种方式
##### 接口类：
```java
public interface A {
    void doIt();
}
```

##### 接口实现类：
```java
public class AImpl implements A{

    public void doIt() {
        System.out.println("I am a impl class");
    }
}
```

##### 代理类：
```java
public class AProxy implements A{

    //被代理的对象实例
    private A a;

    public AProxy(A a) {
        this.a = a;
    }

    public void doIt() {
        //do something
        System.out.println("I am a proxy class");
        //调用真正的实现类
        a.doIt();
        //do something
    }
}
```

##### Main：
```java
public static void main(String[] args) {
        //获取目标类
        A a = new AImpl();

        //通过目标类生成代理类
        A a1 = new AProxy(a);

        //调用目标方法
        a1.doIt();
}
```

##### 输出结果：
```
I am a proxy class
I am a impl class
```

##### 假如需要在接口A、接口B、接口C的某个方法前后加上相同的逻辑（方法的耗时监控）。则需要分别实现AProxy、BProxy、CProxy。
##### 因此这种静态的实现方式很不通用，也很不好扩展

## JDK动态代理
##### 动态代理避免了开发人员编写各个繁锁的静态代理类，只需简单地指定一组接口及目标类对象就能动态的获得代理对象。
```java
public interface A {
    void doIt();

    void doItAgain();
}
```

##### 接口实现类：
```java
public class AImpl implements A{

    public void doIt() {
        System.out.println("I am a impl class");
    }

    public void doItAgain(){
        System.out.println("I am a impl class 2");
    }
}
```

##### 代理类植入方法：
```java
public class HWInvocationHandler implements InvocationHandler {

    //目标对象
    private Object target;

    public HWInvocationHandler(Object target){
        this.target = target;
    }

    public Object invoke(Object proxy, Method method, Object[] args) throws Throwable {
        System.out.println("------插入前置通知代码-------------");
        //执行相应的目标方法
        Object rs = method.invoke(target,args);
        System.out.println("------插入后置处理代码-------------");
        return rs;
    }
}
```

##### Main：
```java
public static void main(String[] args)
    {
        //代理的真实对象
        A a = new AImpl();

        /**
         * InvocationHandlerImpl 实现了 InvocationHandler 接口，并能实现方法调用从代理类到委托类的分派转发
         */
        InvocationHandler handler = new HWInvocationHandler(a);

        ClassLoader loader = a.getClass().getClassLoader();
        Class[] interfaces = a.getClass().getInterfaces();
        /**
         * 该方法用于为指定类装载器、一组接口及调用处理器生成动态代理类实例
         */
        A proxy = (A) Proxy.newProxyInstance(loader, interfaces, handler);

        proxy.doIt();

        proxy.doItAgain();
    }
```

##### 输出结果：
```
------插入前置通知代码-------------
I am a impl class
------插入后置处理代码-------------
------插入前置通知代码-------------
I am a impl class 2
------插入后置处理代码-------------
```

##### 那么，可看到实现过程都是围绕着接口类来的，如果一个类没有定义接口。或者需要代理的方法不属于接口方法时。就没有办法进行代理

## CGLIB动态代理实现

##### CGLib采用了底层的字节码技术，利用asm开源包，通过字节码为一个类创建子类，并在子类中采用方法拦截的技术拦截所有父类方法的调用

#### 结构原理示例
##### 目标类：
```java
public class B{
    void doIt(){
        System.out.println("I am B");
    }
}
```

##### 代理类：
```java
class BProxy extends B{
    void doIt(){
        System.out.println("I am a proxy");
        //do something
        super.doIt();
        //do something
    }
}
```

##### Main：
```java
public static void main(String[] args) {
    //返回对象依然为目标类。但是实际拿到的对象是代理类
    B b = new BProxy();

    b.doIt();
}
```

##### 输出结果：
```
I am a proxy
I am B
```

##### 以上是CGLIB的基本实现原理。CGLIB需要做的就是用字节码实现BProxy类。以及找到那些方法是需要被代理的，然后重写代理方法。

#### CGLIB语法
##### 目标类：
```java
public class B{
    void doIt(){
        System.out.println("I am B");
    }
}
```

##### 代理实现：
```java
class CglibProxy implements MethodInterceptor {
    public Object intercept(Object obj, Method method, Object[] args, MethodProxy proxy) throws Throwable {
        System.out.println("I am a proxy");
        //do something
        Object result = proxy.invokeSuper(obj, args);
        //do something
        return result;
    }
}
```

##### Main：
```java
public static void main(String[] args) {
    //创建CGLIB代理对象
    CglibProxy proxy = new CglibProxy();
    Enhancer enhancer = new Enhancer();
    //设置父类
    enhancer.setSuperclass(B.class);
    enhancer.setCallback(proxy);
    //创建子类实例
    B b = (B) enhancer.create();
    b.doIt();
}
```

#### 输出结果：
```
I am a proxy
I am B
```

##### 以上两种方案就是spring aop的代理实现原理。CGLIB的实现范围几乎包含了JDK动态代理的访问。为什么spring还需要实现两种方式，而不是直接使用CGLIB：
1. 性能：CGLIB毕竟是第三方的实现，在优化方面是没有JDK的优势。按照非官方测试，从jdk6到jdk7再到jdk8。JDK动态代理的效率有质的飞跃。而CGLIB几乎没有变化。
2. 安全：CGLIB毕竟是第三方的实现，虽然通过了JVM的语法检测，但是其实现方式比较底层。仍然有可能会有安全问题，比如内存泄漏。

#### 之前遇到的一个问题：

##### 实现类：
```java
public class Impl {
    public void m1(){
        m2();
    }

    @Transactional
    public void m2(){
        //do something
    }
}
```

##### 接口A：
```java
public interface A {
    void m1();
}
```

##### 接口B：
```java
public interface B {
    void m2();
}
```

##### 接口C：
```java
public interface C {
    void m1();
    void m2();
}
```

##### 以及一些其他问题：
1. private
2. final
3. static

## JAVASSIST

##### Javassist是一个执行字节码操作的强而有力的驱动代码库。它允许开发者自由的在一个已经编译好的类中添加新的方法，或者是修改已有的方法

```java
public class Test {

    protected String get(String s){
        System.out.println(s);
        return null;
    }
}
```

```java
public static void main(String[] args) throws Exception {
        ClassPool aDefault = ClassPool.getDefault();
        aDefault.insertClassPath(new ClassClassPath(JavassistTest.class));
        CtClass ctClass = aDefault.get("com.river.Test");
        CtMethod get = ctClass.getDeclaredMethod("get");
        get.insertBefore("System.out.println(\"s\");");
//        Class<Test> testClass = Test.class;
        Class aClass = ctClass.toClass();
        Test o = (Test)aClass.newInstance();
        o.get("a");
        Test test = new Test();
        test.get("b");
        System.out.println(o.getClass());
        System.out.println(test.getClass());
    }
```

```
s
a
s
b
class com.river.Test
class com.river.Test
```

#### 一些问题：
1. 一个类可以被修改吗
2. 不同类加载器加载的类还是同一个类吗
3. 类在什么时候被加载
4. 一个类可以被加载多少次

##### 实现的大致过程如下
![](/img/note/javassist.png)