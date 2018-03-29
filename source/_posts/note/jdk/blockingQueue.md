---
layout: post
title: java阻塞队列详解
date: 2018/03/27
tags: [tech, index]
tag: [[java, java]]
---

##### `java.util.concurrent`包里的**BlockingQueue**接口表示一个线程安放入和提取实例的队列。这里我们将分析和演示如何使用这个**BlockingQueue**，以及对BlockingQueue的各种实现的源码解析。

<!--more-->

## BlockingQueue的使用

##### **BlockingQueue**的数据结构为队列，通常将操作线程区分为生成者和消费者。下图是对这个原理的阐述：

![blockingQueue](/img/note/jdk/blockingqueue.png)

##### 生产者线程往里边放，消费者线程从里边取的一个BlockingQueue。
##### 生产者线程将会持续生产新对象并将其插入到队列之中，直到队列达到它所能容纳的临界点。也就是说，它是有限的。如果该阻塞队列到达了其临界点，负责生产的线程将会在往里边插入新对象时发生阻塞。它会一直处于阻塞之中，直到负责消费的线程从队列中拿走一个对象。

##### 负责消费的线程将会一直从该阻塞队列中拿出对象。如果消费线程尝试去从一个空的队列中提取对象的话，这个消费线程将会处于阻塞之中，直到生产线程把一个对象丢进队列。

## BlockingQueue
```java
public interface BlockingQueue<E> extends Queue<E> {

    boolean add(E e);

    boolean offer(E e);

    void put(E e) throws InterruptedException;

    boolean offer(E e, long timeout, TimeUnit unit)
        throws InterruptedException;

    E take() throws InterruptedException;

    E poll(long timeout, TimeUnit unit)
        throws InterruptedException;

    int remainingCapacity();

    boolean remove(Object o);

    public boolean contains(Object o);

    int drainTo(Collection<? super E> c);

    int drainTo(Collection<? super E> c, int maxElements);
}
```

##### 接口**BlockingQueue**的方法就是上面几个，分析一下几个主要方法的用途：
1. **offer** & **poll**：往队列中插入、取出数据，如果成功则返回true，如果失败则返回false，这个过程不阻塞，看下ArrayBlockingQueue中的实现：
```java
public boolean offer(E e) {
        checkNotNull(e);
        //通过锁来保证线程安全
        final ReentrantLock lock = this.lock;
        lock.lock();
        try {
            if (count == items.length)
                //如果队列已满
                return false;
            else {
                //如果队列未满，真正的插入操作在enqueue中进行
                enqueue(e);
                return true;
            }
        } finally {
            lock.unlock();
        }
    }
```
```java
public E poll() {
        //通过锁来保证线程安全
        final ReentrantLock lock = this.lock;
        lock.lock();
        try {
            //如果队列为空则返回null，否则通过dequeue拿到队首数据
            return (count == 0) ? null : dequeue();
        } finally {
            lock.unlock();
        }
    }
```
2. **add** & **remove** ：往队列中插入、删除数据，如果成功则返回true，不阻塞，如果失败则抛出异常，看下AbstractQueue中的实现：
```java
public boolean add(E e) {
        if (offer(e))
            return true;
        else
            throw new IllegalStateException("Queue full");
    }
```
```java
public E remove() {
        E x = poll();
        if (x != null)
            return x;
        else
            throw new NoSuchElementException();
    }
```
##### 可以看到add和remove的操作很简单，把具体队列操作都依赖给了offer和pull

3. **put** & **take**：put操作时阻塞队列的核心，将数据插入队列，如果队列满，则阻塞直到插入成功。take和put相对应，从队列中取数据，看下ArrayBlockingQueue中的实现：
```java
public void put(E e) throws InterruptedException {
        checkNotNull(e);
        final ReentrantLock lock = this.lock;
        lock.lockInterruptibly();
        try {
            while (count == items.length)
                notFull.await(); //利用条件对象notFull阻塞
            enqueue(e);
        } finally {
            lock.unlock();
        }
    }
```
```java
public E take() throws InterruptedException {
        final ReentrantLock lock = this.lock;
        lock.lockInterruptibly();
        try {
            while (count == 0)
                notEmpty.await(); //利用条件对象notEmpty阻塞
            return dequeue();
        } finally {
            lock.unlock();
        }
    }
```

##### 知道了**BlockingQueue**的基本用法和简单的实现，那么java中常见的**BlockingQueue**有哪些呢：
* ArrayBlockingQueue
* DelayQueue
* LinkedBlockingQueue
* SynchronousQueue

##### 他们有什么区别呢。下面我们将通过源码来具体分析他们的实现过程。

## ArrayBlockingQueue
##### **ArrayBlockingQueue**类继承了AbstractQueue并实现了**BlockingQueue**接口，来看下**ArrayBlockingQueue**中一些主要的属性。

```java
public class ArrayBlockingQueue<E> extends AbstractQueue<E>
        implements BlockingQueue<E>, java.io.Serializable {
    //使用final 数组保存队列中的数据。数组需要初始化长度。因此数组的长度就是ArrayBlockingQueue的最大容量
    final Object[] items;

    //数组的下标指针，标识着下一步的take, poll, peek or remove操作。相当于头部指针
    int takeIndex;

    ////数组的下标指针，标识着下一步的put, offer, or add操作，相当于尾部指针
    int putIndex;

    //当前队列中已有数据的个数
    int count;

    //锁，保证基本的数据操作的线程安全
    final ReentrantLock lock;

    //条件对象，用于takes操作的等待
    private final Condition notEmpty;

    //条件对象，用于puts操作的等待
    private final Condition notFull;

    //迭代器
    transient Itrs itrs = null;
}
```

##### 可以看到**ArrayBlockingQueue**的底层数据结构是通过有界数组来实现的，因此你必须在创建的时候就应该确定好容量：
```java
public ArrayBlockingQueue(int capacity) {
        this(capacity, false);
    }
```

```java
public ArrayBlockingQueue(int capacity, boolean fair) {
        if (capacity <= 0)
            throw new IllegalArgumentException();
        this.items = new Object[capacity];
        lock = new ReentrantLock(fair);
        notEmpty = lock.newCondition();
        notFull =  lock.newCondition();
    }
```

```java
public ArrayBlockingQueue(int capacity, boolean fair,
                              Collection<? extends E> c) {
        this(capacity, fair);

        final ReentrantLock lock = this.lock;
        lock.lock(); // Lock only for visibility, not mutual exclusion
        try {
            int i = 0;
            try {
                for (E e : c) {
                    checkNotNull(e);
                    items[i++] = e;
                }
            } catch (ArrayIndexOutOfBoundsException ex) {
                throw new IllegalArgumentException();
            }
            count = i;
            putIndex = (i == capacity) ? 0 : i;
        } finally {
            lock.unlock();
        }
    }
```

##### 可以看到ArrayBlockingQueue的初始化可以有三个参数：
1. **capacity（容量）**：三个构造函数都需要的变量，也就是ArrayBlockingQueue的初始容量。
2. **fair（是否公平）**：缺省默认为非公平，这里的公平与非公平主要体现在锁的获取上，ArrayBlockingQueue会更具这个参数来创建公平锁或者非公平锁
3. **c（集合）**：初始集合数据，即使有这个参数，ArrayBlockingQueue依然会按照capacity的大小来初始化数组大小，即使c的容量可能会超过capacity。如果c的容量大于capacity大小。构造函数中会捕获该异常**ArrayIndexOutOfBoundsException**，并抛出一个新的**IllegalArgumentException**异常。

##### 这是**ArrayBlockingQueue**的主要特点，那么我们来看看ArrayBlockingQueue是如何来操作数据添加和删除数据的
#### enqueue（入队）
```java
private void enqueue(E x) {
        final Object[] items = this.items;
        //通过putIndex下标直接插入数据
        items[putIndex] = x;
        //自增putIndex后，如果已经是数组尾部，则重新开始计算，循环指针
        if (++putIndex == items.length)
            putIndex = 0;
        count++;//数据大小加1
        notEmpty.signal(); //释放因为take操作而阻塞的线程
    }
```
##### 该操作为私有操作，只有方法内部可以调用，通过上面的代码我们知道put, offer, add操作都是通过该方法插入的数据，所以在enqueue方法中并没有锁的操作，因为在外部已经获取过锁

#### dequeue（出队）
```java
private E dequeue() {
        final Object[] items = this.items;
        //通过takeIndex获取数组数据
        E x = (E) items[takeIndex];
        //制空
        items[takeIndex] = null;
        //自增takeIndex后，如果已经是数组尾部，则重新开始计算，循环指针
        if (++takeIndex == items.length)
            takeIndex = 0;
        count--;//数据大小减1
        if (itrs != null)
            itrs.elementDequeued();
        notFull.signal();//释放因为put操作而阻塞的线程
        return x; //返回数据
    }
```

## DelayQueue
##### **DelayQueue**是一个无界的**BlockingQueue**，用于放置实现了**Delayed**接口的对象，其中的对象只能在其到期时才能从队列中取走。这种队列是有序的，即队头对象的延迟到期时间最长。注意：不能将null元素放置到这种队列中。

### 先来看下使用过程：
##### 创建一个Delayed，用于保存任务数据以及延迟执行的时间
```java
public class B implements Delayed{

        private long endTime; //执行时间

        public B(long endTime) {
            this.endTime = endTime;
        }

        public long getDelay(TimeUnit unit) {
            return unit.convert(endTime - System.currentTimeMillis(), TimeUnit.MILLISECONDS);
        }

        public int compareTo(Delayed o) {
            if(o == null) return 1;
            if(o == this) return 0;
            if (this.getDelay(TimeUnit.NANOSECONDS) > o.getDelay(TimeUnit.NANOSECONDS)) {
                return 1;
            }else if (this.getDelay(TimeUnit.NANOSECONDS) == o.getDelay(TimeUnit.NANOSECONDS)) {
                return 0;
            }else {
                return -1;
            }
        }
    }
```

##### main方法
```java
public static void main(String[] args) throws InterruptedException {
        DelayQueue<B> delayed = new DelayQueue<B>();
        B b = new B(new Date().getTime() + 10000); //第一个任务在10秒后执行
        B b1 = new B(new Date().getTime() + 5000); //第二个任务在5秒后执行
        delayed.put(b);
        delayed.put(b1);
        System.out.println(delayed.take().getEndTime());
        System.out.println(delayed.take().getEndTime());
    }
```

##### 输出结果：
```
1522220892807
1522220897807
```

### DelayQueue实现细节
#### 看下DelayQueue的属性变量
```java
public class DelayQueue<E extends Delayed> extends AbstractQueue<E>
    implements BlockingQueue<E> {

    //锁，控制队列操作的线程安全
    private final transient ReentrantLock lock = new ReentrantLock();

    //优先队列，实际存储节点的数据结构，优先队列将按照我们提供的compareTo方法进行排序
    //队列中使用数组进行存储数据，但是在容量不够的时候可以动态扩容。在这里初始大小为11
    private final PriorityQueue<E> q = new PriorityQueue<E>();

    //当前头部节点的等待线程，防止多个线程等待同一个节点
    private Thread leader = null;

    //线程阻塞使用Condition实现
    private final Condition available = lock.newCondition();
}
```

#### 我们来看下构造函数：

##### 无参构造函数
```java
public DelayQueue() {}
```

##### 通过集合初始化**DelayQueue**
```java
public DelayQueue(Collection<? extends E> c) {
        this.addAll(c);
}
```

##### 可以看到**DelayQueue**的构造函数非常简单，这是因为**DelayQueue**是无界的，而且真正存储数据的**PriorityQueue**默认就已经初始化完成。所以**DelayQueue**实际并不关心数据的存储，它的核心还是在于take操作的阻塞过程：
```java
public E take() throws InterruptedException {
        final ReentrantLock lock = this.lock; //通过锁来保证线程安全
        lock.lockInterruptibly(); //可中断锁
        try {
            for (;;) {
                E first = q.peek(); //查看队列头部的节点
                if (first == null)
                    available.await(); //如果队列为空，阻塞
                else {
                    long delay = first.getDelay(NANOSECONDS); //获取等待时间
                    if (delay <= 0) //等待时间小于等于0 则直接返回，这是该方法唯一的出口。除非锁中断
                        return q.poll();
                    first = null; // 等待时间大于0，需要阻塞等待
                    if (leader != null)
                        available.await(); //如果有其他线程在等待该节点，则阻塞
                    else {
                        Thread thisThread = Thread.currentThread();
                        leader = thisThread; //设置等待头部节点的线程
                        try {
                            available.awaitNanos(delay); //等待固定时间
                        } finally {
                            if (leader == thisThread)
                                leader = null; //等待结束后释放等待线程，重新获取节点
                        }
                    }
                }
            }
        } finally {
            if (leader == null && q.peek() != null)
                available.signal(); //如果没有线程在等待头部节点，并且队列不为空。则唤醒其他等待线程
            lock.unlock(); //锁释放
        }
    }
```

##### 整理一下操作流程：
1. 获取锁
2. 获取队列头部的节点（不出队）
3. 如果头部节点为空，则判断队列为空，线程阻塞等待并释放锁，唤醒时回到步骤2
4. 如果节点不为空，获取头部节点的等待时间（这里参照之前的例子，需要自行计算等待时间，略坑）
5. 如果等待时间小于等于0。则认为该节点可以返回，调用poll操作返回。这是该方法的唯一一个正常出口
6. 等待时间大于0
    1. 判断是否还有其他线程在等待该节点，如果有，则阻塞并释放锁。（理论上来说等该线程唤醒并执行时获取到的应该是后续的节点了），唤醒时回到步骤2
    2. 如果没有其他线程等待，则通过awaitNanos方法等待固定时间。唤醒时释放头部节点的等待线程。重新回到步骤2
7. 通常情况下，awaitNanos方法过后重新获取节点能够正常返回了。然后调用finally块，在finally中会释放步骤3和步骤6中的第1部分的阻塞线程中的一个。

##### 在上面的操作过程中有一个小坑就是步骤4，这里的等待时间需要自行计算。这里会带来什么坑呢，看个例子：
```java
public static void main(String[] args) throws InterruptedException {
        DelayQueue<B> delayed = new DelayQueue<B>();
        B b = new B(new Date().getTime() + 10000);
        B b1 = new B(new Date().getTime() + 5000);
        delayed.put(b);
        delayed.put(b1);
        b1.setEndTime(b1.getEndTime() + 10000);
        System.out.println(delayed.take().getEndTime());
        System.out.println(delayed.take().getEndTime());
    }

    private static class B implements Delayed{

        private long endTime;

        public B(long endTime) {
            this.endTime = endTime;
        }

        public long getDelay(TimeUnit unit) {
            return unit.convert(endTime - System.currentTimeMillis(), TimeUnit.MILLISECONDS);
        }

        public long getEndTime() {
            return endTime;
        }

        public void setEndTime(long endTime) {
            this.endTime = endTime;
        }

        public int compareTo(Delayed o) {
            if(o == null) return 1;
            if(o == this) return 0;
            if (this.getDelay(TimeUnit.NANOSECONDS) > o.getDelay(TimeUnit.NANOSECONDS)) {
                return 1;
            }else if (this.getDelay(TimeUnit.NANOSECONDS) == o.getDelay(TimeUnit.NANOSECONDS)) {
                return 0;
            }else {
                return -1;
            }
        }
    }
```

##### 输出结果
```
1522230732548
1522230727548
```

##### 解释一下上面的例子，这个例子和之前的例子是一样的。设置了两个任务并且入队。一个任务5秒后执行，一个任务10秒后执行。入队后将5秒执行的任务再往后推迟10秒（变成了15秒）。结果执行结果显示15秒延迟的任务先执行。再立刻执行了10秒延迟任务。

##### 这个坑就在于需要开发者自己去计算到期时间，而且这个时间必须是实时计算出来。如果固定返回一个大于0的数字，这个队列将永远循环阻塞在该节点。后面的任务将不会被执行。就算不是固定时间，但是修改了任务执行时间，任务不会重新排序。导致队列部分后续任务执行时间错误。

##### 当然这样也有一点好处，就是使得**DelayQueue**本身足够简单。**DelayQueue**不用去关心或者计算任务的过期时间，而是把这部分操场依赖给了任务本身。但是没有做到动态的调整队列顺序已保证过期时间计算的复杂性。所以这个操作还是有点坑。

### offer、poll
```java
public boolean offer(E e) {
        final ReentrantLock lock = this.lock;
        lock.lock();
        try {
            q.offer(e); //调用优先队列的offer操作，有排序
            if (q.peek() == e) {
                leader = null; //如果插入的节点是头部节点，则唤醒等待线程
                available.signal();
            }
            return true;
        } finally {
            lock.unlock();
        }
    }
```

```java
public E poll() {
        final ReentrantLock lock = this.lock;
        lock.lock();
        try {
            E first = q.peek();
            if (first == null || first.getDelay(NANOSECONDS) > 0) //如果头部节点为空或者没到执行时间
                return null; //返回空
            else
                return q.poll();
        } finally {
            lock.unlock();
        }
    }
```

## LinkedBlockingQueue
##### LinkedBlockingQueue是一个由链表实现的有界队列阻塞队列。让我们来看下代码：
```java
public class LinkedBlockingQueue<E> extends AbstractQueue<E>
        implements BlockingQueue<E>, java.io.Serializable {

    //链表节点，存储节点数据和下一个节点
    static class Node<E> {
        E item;

        Node<E> next;

        Node(E x) { item = x; }
    }

    //最大容量。默认为Integer.MAX_VALUE
    private final int capacity;

    //线程安全类AtomicInteger，记录链表队列长度
    private final AtomicInteger count = new AtomicInteger();

    //头部节点
    transient Node<E> head;

    //尾部节点
    private transient Node<E> last;

    /** 获取节点操作 的锁 */
    private final ReentrantLock takeLock = new ReentrantLock();

    /** 获取节点操作 的条件对象 */
    private final Condition notEmpty = takeLock.newCondition();

    /** 添加节点操作 的锁 */
    private final ReentrantLock putLock = new ReentrantLock();

    /** 添加节点操作 的条件对象 */
    private final Condition notFull = putLock.newCondition();
}
```

### 看下构造函数
```java
public LinkedBlockingQueue() {
        this(Integer.MAX_VALUE);
    }
```
##### 默认构造函数的初始化大小为Integer.MAX_VALUE

```java
public LinkedBlockingQueue(int capacity) {
        if (capacity <= 0) throw new IllegalArgumentException();
        this.capacity = capacity;
        last = head = new Node<E>(null);
    }
```
##### 头部节点和尾部节点都指向同一个空节点

```java
public LinkedBlockingQueue(Collection<? extends E> c) {
        this(Integer.MAX_VALUE);
        final ReentrantLock putLock = this.putLock;
        putLock.lock(); // Never contended, but necessary for visibility
        try {
            int n = 0;
            for (E e : c) {
                if (e == null)
                    throw new NullPointerException();
                if (n == capacity)
                    throw new IllegalStateException("Queue full");
                enqueue(new Node<E>(e));
                ++n;
            }
            count.set(n);
        } finally {
            putLock.unlock();
        }
    }
```
##### 利用集合初始化队列，设置为Integer.MAX_VALUE容量，然后循环入队enqueue操作

### put
```java
public void put(E e) throws InterruptedException {
        if (e == null) throw new NullPointerException(); //不允许插入空值
        int c = -1;
        Node<E> node = new Node<E>(e); //构建新的节点
        final ReentrantLock putLock = this.putLock;
        final AtomicInteger count = this.count;
        putLock.lockInterruptibly(); //可中断锁
        try {
            while (count.get() == capacity) {
                notFull.await(); //如果队列满，则一直阻塞
            }
            enqueue(node); //如果操作
            c = count.getAndIncrement();
            if (c + 1 < capacity)
                notFull.signal(); //判断这次操作后队列没有满，则唤醒其他入队请求线程
        } finally {
            putLock.unlock(); //解锁
        }
        if (c == 0)
            signalNotEmpty(); //如果本次操作之前队列为空，则在本次操作之后队列不为空了，所以这里需要唤醒获取节点的线程
    }
```

##### 通过**put**方法看到**LinkedBlockingQueue**的操作和**ArrayBlockingQueue**的操作都大同小异，主要是通过**ReentrantLock**来控制线程安全，以及通过**Condition**实现条件阻塞。他们之间主要的不同点就在于他们存储数据的数据结构。

## SynchronousQueue
