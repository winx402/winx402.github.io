---
layout: post
title: java类加载过程
date: 2017/12/26
tags: [tech, index, java]
tag: [[java, java]]
---

# java类加载过程
##### 类从被加载到虚拟机内存中开始，到卸载出内存为止，它的整个生命周期包括：加载，验证，准备，解析，初始化，使用和卸载七个阶段。其中验证，准备和解析三个部分统称为连接，这七个阶段的发生顺序如图所示：
<!--more-->

![java类加载搓成](/img/note/javaClassLoading.png) <div class='img-note'>JAVA类加载过程</div>

### 加载
##### 加载既是将class文件字节码加载到内存中，并将这些静态数据转换为jvm方法区运行时数据结构。在堆中生成一个代表这个类的java.lang.Class对象，作为方法区访问对象的入口。
### 链接
##### 将已读入内存的二进制数据合并到JVM运行状态中去的过程。包含验证、准备、解析等过程。
#### 验证:
1. 类文件结构检查：确保加载的类信息符合JVM规范，遵从类文件结构的固定格式。
2. 元数据验证：确保类本身符合Java语言的语法规定，比如验证final类型的类没有子类，以及final类型的方法没有被覆盖。注意，语义检查的错误在编译器编译阶段就会通不过，但是如果有程序员通过非编译的手段生成了类文件，其中有可能会含有语义错误，此时的语义检查主要是防止这种没有编译而生成的class文件引入的错误。
3. 字节码验证：确保字节码流可以被Java虚拟机安全地执行。字节码流代表Java方法(包括静态方法和实例方法)，它是由被称作操作码的单字节指令组成的序列，每一个操作码后都跟着一个或多个操作数。字节码验证步骤会检查每个操作码是否合法，即是否有着合法的操作数。
4. 二进制兼容性验证：确保相互引用的类之间的协调一致。例如，在Worker类的gotoWork()方法中会调用Car类的run()方法，Java虚拟机在验证Worker类时，会检查在方法区内是否存在Car类的run()方法，假如不存在(当Worker类和Car类的版本不兼容就会出现这种问题)，就会抛出NoSuchMethodError错误。

#### 准备:
1. 正式为类变量分配内存，并设置类变量初始值的阶段。这些内存都将在方法区分配。这个时候进行内存分配的仅包括类变量（static变量），而不包括实例变量。实例变量将会在对象实例化时随着对象一起分配在java堆中
2. 这里所说的初始值"通常情况下"是数据类型的零值，假设一个类型变量定义为：`public static int value = 123;`，那么变量value在准备过后的初始值为0而不是123。而把value赋值为123的动作存放于类构造器&lt;clinit&gt;中，该方法将在初始化阶段才会执行。
3. 上面所说的是通常情况，会有一些"特殊情况下"：如果类字段的字段属性表中存在ConstantValues属性，那么准备阶段value就会被初始化为ConstantValues。例如：`public static final int value = 123;`

#### 解析：
1. 虚拟机常量池内的符号引用替换为直接引用的过程。
2. 例如在Worker类的gotoWork()方法中会引用Car类的run()方法。
```java
public void gotoWork() {
    car.run();// 这段代码在Worker类的二进制数据中表示为符号引用
}
```
3. 在Worker类的二进制数据中，包含了一个对Car类的run()方法的符号引用，它由run()方法的全名和相关描述符组成。
4. 在解析阶段，Java虚拟机会把这个符号引用替换为一个指针，该指针指向Car类的run()方法在方法区内的内存位置，这个指针就是直接引用。

### 初始化
##### 类初始化是类加载过程的最后一步，前面的类加载过程，除了在加载阶段用户应用程序可以通过自定义类加载器参与之外，其余动作完全由虚拟机主导和控制。到了初始化阶段，才真正开始执行类中定义的Java程序代码。初始化是执行类的构造器&lt;clinit&gt;()方法的过程。
##### 类构造器&lt;clinit&gt;()方法是由编译器自动收集类中的所有类变量的赋值动作和静态语句块（static块）中的语句合并产生的。
##### 当初始化一个类的时候，如果发现其父类还没有进行过初始化、则需要先触发其父类的初始化。
##### 虚拟机会保证一个类的&lt;clinit&gt;()方法在多线程环境中被正确加锁和同步。
##### 当访问一个java类的静态域时，只有真正声明这个域的类才会被初始化。

#### 说明 &lt;clinit&gt; 与&lt;init&gt;方法
##### 可能出现在class文件中的两种编译器产生的方法是：实例初始化方法(名为&lt;init&gt;)和类与接口初始化方法(名为&lt;clinit&gt;)。
##### 这两个方法一个是虚拟机在装载一个类初始化的时候调用的（clinit）。另一个是在类实例化时调用的（init）
##### &lt;clinit&gt;方法：所有的类变量初始化语句和类型的静态初始化语句都被Java编译器收集到了一起，放在一个特殊的方法中。这个方法就是&lt;clinit&gt;
##### &lt;init&gt;方法：是在一个类进行对象实例化时调用的。实例化一个类有四种途径：调用new操作符；调用Class或java.lang.reflect.Constructor对象的newInstance()方法；调用任何现有对象的clone()方法；通过java.io.ObjectInputStream类的getObject()方法反序列化。Java编译器会为它的每一个类都至少生成一个实例初始化方法。在Class文件中,被称为"&lt;init&gt;"
##### 区别：一个是用于初始化静态的类变量， 一个是初始化实例变量!

### 使用
##### 使用既是所需要的对象开始被调用。

### 卸载
##### 对象被jvm回收。

#### 示例

```java
public class InitDemo {

    static {
        System.out.println("InitDemo static init ...");
    }

    public static void main(String[] args) {
        System.out.println("InitDemo main begin");
        InitA a = new InitA();
        System.out.println(InitA.width);
        InitA b = new InitA();

    }
}
```

```java
class InitBase{

    static {
        System.out.println("InitBase static init ...");
    }
}
```

```java
class InitA extends InitBase {

    public static int width = 60;

    static {
        System.out.println("InitA static init ...");
        width = 30;
    }

    public InitA() {
        System.out.println(" InitA init ... ");
    }
}
```

##### 运行结果：

```
InitDemo static init ...
InitDemo main begin
InitBase static init ...
InitA static init ...
 InitA init ...
30
 InitA init ...
```

##### 可以看到，在执行结果中，先运行main方法所在类的初始化方法，之后运行main函数。然后运行父类InitBase的初始化方法。之后运行InitA的静态初始化。以及InitA的构造函数。此后虽然new了多个InitA，但是其静态的初始化方法&lt;clinit&gt;只运行了一次。

# 被动引用和主动引用
##### 在java虚拟机规范中，严格规定了，只有对类进行主动引用，才会触发其初始化方法。而除此之外的引用方式称之为被动引用，不会触发类的初始化方法。
### 主动引用
##### 虚拟机规范规定只有如下四种情况才能触发主动引用：
#### 遇到new、getstatic、setstatic、invokestatic 4条指令时，如果类没有初始化，则需要触发其初始化（final修饰的常量除外）。
#### (1).使用new关键字实例化对象

```java
public class NewClass {

    static {
        System.out.println("NewClass init ...");
    }

}
```

```java
class Init1{
    public static void main(String[] args) {
        new NewClass();
    }
}
```

##### 运行结果：
```
NewClass init ...
```

#### (2).读取类的静态成员变量

```java
public class StaticAttributeClass {

    public static int value = 10;

    public static void staticMethod() {

    }

    static {
        System.out.println("StaticAttributeClass init ...");
    }
}
```

```java
class Init2{
    public static void main(String[] args) {
        //1.读取静态变量
        int value = StaticAttributeClass.value;
    }
}
```
##### 运行结果：
```
StaticAttributeClass init ...
```

#### (3).设置类的静态成员变量
```java
class Init2{
    public static void main(String[] args) {
        StaticAttributeClass.value = 5
    }
}
```
##### 运行结果：
```
StaticAttributeClass init ...
```

#### (4).调用静态方法
```java
class Init2{
    public static void main(String[] args) {
        StaticAttributeClass.staticMethod();
    }
}

```
##### 运行结果：
```
StaticAttributeClass init ...
```

#### 使用java.lang.reflenct包的方法对类进行放射调用，如果没有进行初始化，则需要触发其初始化。
```java
public class ReflectClass {

    static {
        System.out.println("ReflectClass init ...");
    }
}
```

```java
class Init3{
    public static void main(String[] args) {
        try {
            Class clazz = Class.forName("com.dhb.classload.ReflectClass");
        } catch (ClassNotFoundException e) {
            e.printStackTrace();
        }
    }
}
```
##### 运行结果：
```
ReflectClass init ..
```

#### 当一个类初始化的时候，如果其父类还没有初始化，则需要先对其父类进行初始化。
```java
public class SuperClass {
    static {
        System.out.println("SuperClass init ...");
    }
    public static int value = 10;
}
```

```java
class SubClass extends SuperClass {
    static {
        System.out.println("SubClass init ...");
    }
}
```

```java
class Init4 {
    public static void main(String[] args) {
        new SubClass();
    }
}
```
##### 运行结果：
```
SuperClass init ...
SubClass init ...
```

#### 当虚拟机启动时，用户需要指定一个执行的主类，虚拟机会首先初始化这个主类
```java
public class MainClass {

    static {
        System.out.println("MainClass init ...");
    }

    public static void main(String[] args) {
        System.out.println("main begin ...");
    }
}
```
##### 运行结果：
```
MainClass init ...
main begin ...
```

### 被动引用
##### 主动引用之外的引用情况都称之为被动引用，这些引用不会进行初始化。
#### 通过子类引用父类的静态字段，不会导致子类初始化
```java
public class SuperClass {
    static {
        System.out.println("SuperClass init ...");
    }
    public static int value = 10;
}
```

```java
class SubClass extends SuperClass {
    static {
        System.out.println("SubClass init ...");
    }

}
```

```java
class Init4 {
    public static void main(String[] args) {
        int value = SubClass.value;
    }
}
```
##### 运行结果：
```
SuperClass init ...
```

#### 通过数组定义来引用，不会触发此类的初始化
```java
public class ArrayClass {

    static {
        System.out.println("ArrayClass init ...");
    }
}
```

```java
class Init5{
    public static void main(String[] args) {
        ArrayClass[] arrays = new  ArrayClass[10];
    }
}
```
##### 运行结果为空

#### 常量在编译阶段会存入调用类的常量池中，本质没有直接引用到定义的常量类中，因此不会触发定义的常量类初始化
```java
public class ConstClass {
    static {
        System.out.println("ConstClass init ...");
    }

    public static final int value = 10;
}
```

```java
class Init6{
    public static void main(String[] args) {
        int value = ConstClass.value;
    }
}
```
##### 运行结果为空

### 2.3练习题
如下类的输出：
```java
public class Singleton {

    private static Singleton instance = new Singleton();

    public static int x = 0;
    public static int y;

    private Singleton () {
        x ++;
        y ++;
    }

    public static Singleton getInstance() {
        return instance;
    }

    public static void main(String[] args) {
        Singleton singleton = getInstance();
        System.out.println(x);
        System.out.println(y);
    }
 }
```
##### 运行结果:
```
0
1
```

##### 输出结果竟然是 x为0 y为1 !!!
##### 其实理解了类的加载过程也就不难理解，其过程如下：

1. 执行链接过程，初始化所有的类变量：
instance -> null
x -> 0
y -> 0
2. 执行初始化过程：
new Singleton() 调用构造方法
之后 x -> 1 y -> 1
再执行 x = 0 赋值
最终
x -> 0
y -> 1