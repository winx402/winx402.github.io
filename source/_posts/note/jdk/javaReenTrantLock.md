---
layout: post
title: Java并发之ReentrantLock
date: 2018/04/10
tags: [tech, index, java]
tag: [[java, java]]
original: true
---

##### Java 的**ReentrantLock**是我们最常用的java锁之一。**ReentrantLock**实现了我们最常用的一些锁的特性，那么它是如何实现这些过程的呢。其实现的原理是基于**AbstractQueuedSynchronizer**（AQS）和 自定义同步器 **sync** 的。关于AQS的实现原理可以去看我的另一篇文章：[Java并发之AQS](https://winx402.github.io/note/jdk/JavaAQS/)
<!-- more -->

## 结构
##### **ReentrantLock**实现了公平锁和非公平锁，它的实现过程主要是通过对AQS的**state**状态采取独占的操作方式，我们知道在AQS中state为0表示正常状态（释放中），为1则表示线程占用状态（也就是排他锁的概念，当然还有可能大于1，因为锁可以重入），而这些对于AQS的操作方式又是通过自定义同步器**Sync**来完成的：
```java
private final Sync sync;
```

##### **ReentrantLock**相对应的实现了两个**Sync**：
```java
//非公平锁的实现
static final class NonfairSync extends Sync
```

```java
//公平锁的实现
static final class FairSync extends Sync
```

##### 可以看到NonfairSync和NonfairSync都是继承的同一个Sync，而且他们是final类型的，都不能被再次继承。
```java
//基类Sync，继承了AQS
abstract static class Sync extends AbstractQueuedSynchronizer
```

## 源码详解
### 构造函数
```java
public ReentrantLock() {
    sync = new NonfairSync();
}
```

##### 默认构造函数将使用非公平实现方案

```java
public ReentrantLock(boolean fair) {
    sync = fair ? new FairSync() : new NonfairSync();
}
```

##### 公平或者非公平主要就体现在使用FairSync或者NonfairSync

### lock()
```java
public void lock() {
    sync.lock();
}
```
##### **ReentrantLock**的lock操作完全交给同步器Sync去执行，让我们来看下他们是怎么实现的：
#### NonfairSync 的 lock()
```java
final void lock() {
    if (compareAndSetState(0, 1))
        setExclusiveOwnerThread(Thread.currentThread());
    else
        acquire(1);
}
```
##### NonfairSync的lock操作是基于对AQS对state状态的修改，很简单，主要分两步：
1. 直接通过CAS操作AQS的状态，如果是0则修改成1（该过程的语义可以理解成：如果没有线程正在占用锁，则占用该锁），修改成功则表示锁获取成功，之后设置AbstractOwnableSynchronizer的thread为当前线程
2. 如果修改失败，则调用acquire（独占的方式）操作去获取锁。

##### acquire(int) 在AQS中已经详细的说明了，这里简单提一下：
```java
public final void acquire(int arg) {
    if (!tryAcquire(arg) &&
        acquireQueued(addWaiter(Node.EXCLUSIVE), arg))
        selfInterrupt();
}
```

1. tryAcquire()尝试直接去获取资源，如果成功则直接返回；
2. addWaiter()将该线程加入等待队列的尾部，并标记为独占模式；
3. acquireQueued()使线程在等待队列中获取资源，一直获取到资源后才返回。如果在整个等待过程中被中断过，则返回true，否则返回false。
4. 如果线程在等待过程中被中断过，它是不响应的。只是获取资源后才再进行自我中断selfInterrupt()，将中断补上。

##### 而我们主要需要实现的就是tryAcquire(int)函数：
```java
//NonfairSync
protected final boolean tryAcquire(int acquires) {
    return nonfairTryAcquire(acquires);
}
```
##### 在非公平实现中主要通过基类Sync的nonfairTryAcquire(int)来实现：
```java
final boolean nonfairTryAcquire(int acquires) {
    //获取当前线程
    final Thread current = Thread.currentThread();
    //获取AQS状态（state为volatile变量）
    int c = getState();
    if (c == 0) {
        //这一步和NonfairSync 的 lock()的第一步是一样的，不重复解释了
        if (compareAndSetState(0, acquires)) {
            setExclusiveOwnerThread(current);
            return true;
        }
    }
    //判断当前线程是否已经获取到锁，可重入锁的实现
    else if (current == getExclusiveOwnerThread()) {
        int nextc = c + acquires;
        if (nextc < 0) // overflow
            throw new Error("Maximum lock count exceeded");
        setState(nextc);
        return true;
    }
    return false;
}
```
##### nonfairTryAcquire的过程在上面代码中已经简单说明，可以看到tryAcquire（nonfairTryAcquire）操作只是针对一次性的获取操作，这里并没有重试或者自旋。因为相应的过程都在acquire(int)中实现。

#### FairSync 的 lock()
```java
final void lock() {
    acquire(1);
}
```
##### 和非公平的实现相比，少了一步cas操作，直接通过AQS的acquire去独占state。这里也是非公平的区别之一，非公平的实现导致新加入的线程不用经过队列而是直接尝试获取锁，这个时候队列中很有可能存在其他的等待线程，这些队列中的线程可能正在唤醒的过程中。而非公平的这种操作对于系统来说性能是更高的，因为线程的唤醒需要时间。

##### **acquire(int)**的操作和非公平一样，我们直接看**FairSync**的**tryAcquire(int)**:
```java
protected final boolean tryAcquire(int acquires) {
    //获取当前线程
    final Thread current = Thread.currentThread();
    //获取锁的状态
    int c = getState();
    if (c == 0) {
        //如果锁是释放的，并且队列中有其他线程正在前面等待。
        if (!hasQueuedPredecessors() &&
            compareAndSetState(0, acquires)) {
            setExclusiveOwnerThread(current);
            return true;
        }
    }
    else if (current == getExclusiveOwnerThread()) {
        int nextc = c + acquires;
        if (nextc < 0)
            throw new Error("Maximum lock count exceeded");
        setState(nextc);
        return true;
    }
    return false;
}
```

##### 这里和非公平的实现**nonfairTryAcquire**也很像，唯一的区别在于获取锁的时候需要判断一次队列情况，也正是这个操作，导致了公平锁的实现是不能插队的，我们看下hasQueuedPredecessors的实现：
```java
public final boolean hasQueuedPredecessors() {
    Node t = tail;
    Node h = head;
    Node s;
    return h != t &&
        ((s = h.next) == null || s.thread != Thread.currentThread());
}
```

##### 简单来说hasQueuedPredecessors返回true需要同时满足下面2个条件：
1. 操作state的等待队列不为空
2. 队列的下一个操作线程和当前线程不是同一个线程（这里的语义和acquireQueued中很像，都是判断是否为队列的第二个节点，因为第一个节点为操作state的线程，所以第二个节点很可能是第一个节点唤醒的，所以是有机会的）。

### unlock()
```java
public void unlock() {
    sync.release(1);
}
```
##### 通过操作AQS的释放操作，完成解锁语义，看下release(int):
```java
public final boolean release(int arg) {
    if (tryRelease(arg)) {
        Node h = head;//找到头结点
        if (h != null && h.waitStatus != 0)
            unparkSuccessor(h);//唤醒等待队列里的下一个线程
        return true;
    }
    return false;
}
```
##### release操作在AQS文章中也已经说明，不再赘诉，直接看tryRelease(int)实现。
```java
protected final boolean tryRelease(int releases) {
    int c = getState() - releases;
    if (Thread.currentThread() != getExclusiveOwnerThread())
        throw new IllegalMonitorStateException();
    boolean free = false;
    if (c == 0) {
        free = true;
        setExclusiveOwnerThread(null);
    }
    setState(c);
    return free;
}
```
##### tryRelease的实现不区分公平非公平，其主要流程如下：
1. 计算state释放releases后的值
2. 查看当前线程是否持有该锁，如果不持有。抛出异常
3. 如果锁被完全释放(state == 0)，设置持有线程为null
4. 则设置剩余状态值

### lockInterruptibly()
```java
public void lockInterruptibly() throws InterruptedException {
    sync.acquireInterruptibly(1);
}
```

##### 直接看AQS的acquireInterruptibly(int)和doAcquireInterruptibly(int):
```java
public final void acquireInterruptibly(int arg)
        throws InterruptedException {
    if (Thread.interrupted())
        throw new InterruptedException();
    if (!tryAcquire(arg))
        doAcquireInterruptibly(arg);
}
```

```java
private void doAcquireInterruptibly(int arg)
    throws InterruptedException {
    final Node node = addWaiter(Node.EXCLUSIVE);
    boolean failed = true;
    try {
        for (;;) {
            final Node p = node.predecessor();
            if (p == head && tryAcquire(arg)) {
                setHead(node);
                p.next = null; // help GC
                failed = false;
                return;
            }
            if (shouldParkAfterFailedAcquire(p, node) &&
                parkAndCheckInterrupt())
                throw new InterruptedException();
        }
    } finally {
        if (failed)
            cancelAcquire(node);
    }
}
```

##### 如果你和AQS的acquireQueued方法做对比会发现doAcquireInterruptibly的一个主要区别就是如果中断则直接抛出中断异常，而acquireQueued中只是记录中断。

### tryLock()
```java
public boolean tryLock() {
    return sync.nonfairTryAcquire(1);
}
```

##### 如果调用tryLock()，则并不关心是否公平，和非公平的tryAcquire操作相同，不做等待和重试操作

### getHoldCount()
```java
public int getHoldCount() {
    return sync.getHoldCount();
}
```

##### 获取**ReentrantLock**的**lock()**方法被调用了几次（重入了几次），就是**state**的当前值

### getOwner()
```java
protected Thread getOwner() {
    return sync.getOwner();
}
```

```java
final Thread getOwner() {
    return getState() == 0 ? null : getExclusiveOwnerThread();
}
```

##### 获取当前占有锁的线程，就是**AbstractOwnableSynchronizer**中**exclusiveOwnerThread**的值

### getQueuedThreads()
```java
protected Collection<Thread> getQueuedThreads() {
    return sync.getQueuedThreads();
}
```

```java
public final Collection<Thread> getQueuedThreads() {
    ArrayList<Thread> list = new ArrayList<Thread>();
    for (Node p = tail; p != null; p = p.prev) {
        Thread t = p.thread;
        if (t != null)
            list.add(t);
    }
    return list;
}
```

##### 获取等待持有锁的线程集合。队列从后向前遍历

### getQueuedLength()
```java
public final int getQueueLength() {
    return sync.getQueueLength();
}
```

```java
public final int getQueueLength() {
    int n = 0;
    for (Node p = tail; p != null; p = p.prev) {
        if (p.thread != null)
            ++n;
    }
    return n;
}
```

##### 获取等待持有锁的队列长度，和**getQueuedThreads**类似，通过遍历计数后返回

## 总结
##### 通过源码分析，发现其实**ReentrantLock**的实现是非常简单的，只要理解了AQS的实现过程，剩下的就是自定义同步器**NonfairSync**和**FairSync**对于**AQS**的**state**采用独占方式的获取和释放。锁的特性和概念也正是在这个过程中被实现和赋予其含义的。