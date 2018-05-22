---
layout: post
title: ThreadPoolExecutor源码阅读
date: 2018/05/21
original: true
tags: [tech, index, java]
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

### 线程安全AtomicInteger变量ctl
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


### 线程池状态
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

### 阻塞队列
```java
private final BlockingQueue<Runnable> workQueue;
```
##### 阻塞对流用于存放用户提交的任务，final关键字表示其必须在构造函数中进行初始化，并且之后不能修改。目前常用的阻塞队列有ArrayBlockingQueue、LinkedBlockingQueue、SynchronousQueue。关于Java中阻塞队列的具体实现，可以参考的另外一篇文章[java阻塞队列详解](https://winx402.github.io/note/jdk/blockingQueue/)

### 构造函数
```java
public ThreadPoolExecutor(int corePoolSize,
                          int maximumPoolSize,
                          long keepAliveTime,
                          TimeUnit unit,
                          BlockingQueue<Runnable> workQueue,
                          ThreadFactory threadFactory,
                          RejectedExecutionHandler handler) {
    if (corePoolSize < 0 ||
        maximumPoolSize <= 0 ||
        maximumPoolSize < corePoolSize ||
        keepAliveTime < 0)
        throw new IllegalArgumentException();
    if (workQueue == null || threadFactory == null || handler == null)
        throw new NullPointerException();
    this.acc = System.getSecurityManager() == null ?
            null :
            AccessController.getContext();
    this.corePoolSize = corePoolSize;
    this.maximumPoolSize = maximumPoolSize;
    this.workQueue = workQueue;
    this.keepAliveTime = unit.toNanos(keepAliveTime);
    this.threadFactory = threadFactory;
    this.handler = handler;
}
```
##### 构造函数的参数主要是一下含义：
1. corePoolSize：核心线程数
2. maximumPoolSize：最大线程数
3. keepAliveTime、unit：线程存活时间以及时间单位
4. workQueue：阻塞队列，存放任务
5. threadFactory：创建线程的线程工厂
6. handler：拒绝策略

### 提交任务：execute
```java
public void execute(Runnable command) {
    if (command == null)
        throw new NullPointerException();
    //获取ctl
    int c = ctl.get();
    //如果当前线程池的线程数量小于核心线程数。则直接添加线程
    if (workerCountOf(c) < corePoolSize) {
        if (addWorker(command, true))
            return;
        //如果添加线程失败，则刷新ctl
        c = ctl.get();
    }
    //如果线程池状态正常，尝试将任务插入队列尾部
    if (isRunning(c) && workQueue.offer(command)) {
        int recheck = ctl.get();
        //再次检查县城次状态，如果不是运行状态
        if (! isRunning(recheck) && remove(command))
            reject(command);
        //如果线程池当前没有线程正在运行，则通过一个空的任务添加一个线程。
        else if (workerCountOf(recheck) == 0)
            addWorker(null, false);
    }
    //如果因为线程池状态关闭，或者因为队列添加失败，则尝试新建一个线程执行任务
    else if (!addWorker(command, false))
        //拒绝
        reject(command);
}
```

##### 让我们看下addWorker(Runnable, boolean):
```java
private boolean addWorker(Runnable firstTask, boolean core) {
    retry:
    for (;;) {
        //获取ctl
        int c = ctl.get();
        //线程池状态
        int rs = runStateOf(c);
        // Check if queue empty only if necessary.
        // 如果线程池的状态不是运行中（也就是线程池已经关闭，并且不接受新的任务），以及排除状态为SHUTDOWN，并且firstTask为null，workQueue不为空这种情况。
        if (rs >= SHUTDOWN &&
            ! (rs == SHUTDOWN &&
               firstTask == null &&
               ! workQueue.isEmpty()))
            //可以认为线程池已经关闭，添加任务失败，返回false
            return false;
        for (;;) {
            //获取工作线程数量
            int wc = workerCountOf(c);
            //如果线程数量超出上限（2^29），或者超出核心线程、最大线程。则添加失败
            if (wc >= CAPACITY ||
                wc >= (core ? corePoolSize : maximumPoolSize))
                return false;
            //如果线程数量正常，则尝试通过cas修改线程数量。如果修改成功，跳出循环
            if (compareAndIncrementWorkerCount(c))
                break retry;
            //修改ctl失败，重新获取ctl
            c = ctl.get();  // Re-read ctl
            //如果线程池状态已经被修改，则跳转retry重新判断。否则for循环重试修改线程数量
            if (runStateOf(c) != rs)
                continue retry;
            // else CAS failed due to workerCount change; retry inner loop
        }
    }
    boolean workerStarted = false;
    boolean workerAdded = false;
    Worker w = null;
    try {
        //创建一个新的worker工作线程，注意firstTask可以为null
        w = new Worker(firstTask);
        final Thread t = w.thread;
        if (t != null) {
            final ReentrantLock mainLock = this.mainLock;
            //获取独占锁
            mainLock.lock();
            try {
                // 获取线程池最新状态
                int rs = runStateOf(ctl.get());
                //可以看到这里的状态判断和方法开始处的状态判断刚好相反。该判断表示线程池状态是否能够正常执行下去
                if (rs < SHUTDOWN ||
                    (rs == SHUTDOWN && firstTask == null)) {
                    if (t.isAlive()) // precheck that t is startable
                        throw new IllegalThreadStateException();
                    //线程池状态正常，将worker添加进集合
                    workers.add(w);
                    int s = workers.size();
                    //如果当前线程池中的线程数量大于最大线程数，则修改最大线程数
                    if (s > largestPoolSize)
                        largestPoolSize = s;
                    //状态修改，线程添加进池成功
                    workerAdded = true;
                }
            } finally {
                mainLock.unlock();
            }
            if (workerAdded) {
                //线程启动
                t.start();
                workerStarted = true;
            }
        }
    } finally {
        if (! workerStarted)
            addWorkerFailed(w);
    }
    return workerStarted;
}
```

##### 通过execute方法和addWorker方法。可以看到，当我们向线程池中添加一个任务的时候，线程池主要有以下几个处理流程：
1. 如果线程池中的线程数量少于核心线程数，则直接创建新的线程执行任务
2. 如果以及达到核心线程数，则尝试将任务提交至队列中
3. 如果队列满，则尝试使用最大线程数量创建新的线程去执行
4. 如果超出最大线程数，则使用拒绝策略拒绝该任务

##### 在这个过程中，我们注意到，提交任务的时候，如果判断到当前的的执行线程数量为0，那么会通过一个addWorker方法提交一个空的任务。并且在addWorker中能够成功的将其包装成Worder类并开始执行。那么在Worder类中，是如何处理这个空的任务呢。

### 任务的执行过程：runWorker(Worker)：
```java
final void runWorker(Worker w) {
    //获取当前执行线程，也就是线程池中的线程
    Thread wt = Thread.currentThread();
    //获取任务
    Runnable task = w.firstTask;
    w.firstTask = null;
    w.unlock(); // allow interrupts
    //线程异常中断
    boolean completedAbruptly = true;
    try {
        //循环判断任务不为空，获取下一个任务不为空
        while (task != null || (task = getTask()) != null) {
            w.lock(); //加锁执行
            if ((runStateAtLeast(ctl.get(), STOP) ||
                 (Thread.interrupted() &&
                  runStateAtLeast(ctl.get(), STOP))) &&
                !wt.isInterrupted())
                //线程中断
                wt.interrupt();
            try {
                //前置方法。默认为空
                beforeExecute(wt, task);
                Throwable thrown = null;
                try {
                    //真正的任务执行，这里很有意思的是没有通过线程的start方法执行。而是直接调用的run方法。Runnable只是一个任务的载体
                    task.run();
                } catch (RuntimeException x) {
                    thrown = x; throw x;
                } catch (Error x) {
                    thrown = x; throw x;
                } catch (Throwable x) {
                    thrown = x; throw new Error(x);
                } finally {
                    //后置方法
                    afterExecute(task, thrown);
                }
            } finally {
                //将task置为null，方便循环中获取队列的下一个任务
                task = null;
                w.completedTasks++;
                w.unlock();
            }
        }
        completedAbruptly = false;
    } finally {
        processWorkerExit(w, completedAbruptly);
    }
}
```

##### 线程池中的线程处理流程很简单，就是重复的从队列当中获取新的任务并且执行。如果getTask方法获取不到新的任务，则在finally中通过processWorkerExit将该线程从线程池中删除。

### 参考资料
[ThreadPoolExecutor](https://docs.oracle.com/javase/7/docs/api/java/util/concurrent/ThreadPoolExecutor.html)
[Java线程池使用说明](http://www.oschina.net/question/565065_86540)