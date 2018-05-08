---
layout: post
title: ThreadPoolExecutor源码阅读
date: 2018/01/05
original: true
tag: [[java, java]]
---

##### 线程的使用在java中占有极其重要的地位，在jdk1.4极其之前的jdk版本中，关于线程池的使用是极其简陋的。在jdk1.5之后这一情况有了很大的改观。Jdk1.5之后加入了java.util.concurrent包，这个包中主要介绍java中线程以及线程池的使用。为我们在开发中处理线程的问题提供了非常大的帮助。

<!--more-->

##### 线程池的作用和优点就不多说，直接上源码：

### ThreadPoolExecutor结构图

```java
public class ThreadPoolExecutor extends AbstractExecutorService
```

|—java.lang.Object
|——java.util.concurrent.AbstractExecutorService
|———java.util.concurrent.ThreadPoolExecutor

#### 所有引用的接口：
java.util.concurrent.Executor
java.util.concurrent.ExecutorService

### ThreadPoolExecutor代码
#### 线程安全AtomicInteger变量ctl
```java
/**
     * The main pool control state, ctl, is an atomic integer packing
     * two conceptual fields
     *   workerCount, indicating the effective number of threads
     *   runState,    indicating whether running, shutting down etc
     *
     * In order to pack them into one int, we limit workerCount to
     * (2^29)-1 (about 500 million) threads rather than (2^31)-1 (2
     * billion) otherwise representable. If this is ever an issue in
     * the future, the variable can be changed to be an AtomicLong,
     * and the shift/mask constants below adjusted. But until the need
     * arises, this code is a bit faster and simpler using an int.
     *
     * The workerCount is the number of workers that have been
     * permitted to start and not permitted to stop.  The value may be
     * transiently different from the actual number of live threads,
     * for example when a ThreadFactory fails to create a thread when
     * asked, and when exiting threads are still performing
     * bookkeeping before terminating. The user-visible pool size is
     * reported as the current size of the workers set.
     */
private final AtomicInteger ctl = new AtomicInteger(ctlOf(RUNNING, 0));
```
##### 在该变量属性上已经有较为详细的介绍了。大致的意思是ctl是线程池的主要控制变量，这个变量主要有两个含义：
1. 工作线程数量，表示实际的线程数量
2. 线程池状态，线程池的各种状态情况，后面会详细介绍

##### 那么如何用着一个变量来表示两个不同的含义呢。我们都知道，java中的int有32位，其中最高位为状态位，表示正负，因此java中int能够表示的大小范围在-2<sup>31</sup>~2<sup>31</sup>-1。因此，这里将int的32位分为了两部分，其中低29位用来表示工作线程数量，一共2<sup>29</sup>-1 大约5亿。这里的工作线程数表示那些已经被允许开始并且没有被允许停止的线程。而高3位则用来表示线程池的状态，这个将在后面具体介绍。


#### 线程池状态
```java
private static final int COUNT_BITS = Integer.SIZE - 3;

// runState is stored in the high-order bits
private static final int RUNNING    = -1 << COUNT_BITS;
private static final int SHUTDOWN   =  0 << COUNT_BITS;
private static final int STOP       =  1 << COUNT_BITS;
private static final int TIDYING    =  2 << COUNT_BITS;
private static final int TERMINATED =  3 << COUNT_BITS;
```
##### `COUNT_BITS`等于29，表示低的29位。
1. RUNNING：运行状态，高三位都为1时表示(11100000000000000000000000000000), 表示线程池接受新的任务和处理队列中已有的任务；
2. SHUTDOWN：00000000000000000000000000000000，不接受新的任务，但是处理队列中的任务；
3. STOP：00100000000000000000000000000000，不接受新任务，也不处理队列任务，并且中断(interrupt)正在处理的任务；
4. TIDYING：01000000000000000000000000000000，所有的任务都已经终结，工作线程数为0。将要执行terminated()钩子方法；
5. TERMINATED：01100000000000000000000000000000，terminated()方法执行完成。

#### 用户存放任务的阻塞队列
```java
private final BlockingQueue<Runnable> workQueue;
```
##### final关键字表示其必须在构造函数中进行初始化




### 参考资料
[ThreadPoolExecutor](https://docs.oracle.com/javase/7/docs/api/java/util/concurrent/ThreadPoolExecutor.html)
[Java线程池使用说明](http://www.oschina.net/question/565065_86540)