---
layout: post
title: 数据结构-Java实现
date: 2019/11/10
tags: []
tag: [[java, java]]
---

##### 数据结构是计算机存储、组织数据的方式。数据结构是指相互之间存在一种或多种特定关系的数据元素的集合。通常情况下，精心选择的数据结构可以带来更高的运行或者存储效率。数据结构往往同高效的检索算法和索引技术有关。

#### 常用的数据结构包括以下几种：
* 数组(Array)
* 链表(Linked List)
* 散列表(Hash)
* 栈( Stack)
* 队列(Queue)
* 树(Tree)
* 堆(Heap)
* 图(Graph)

<!--more-->

##### 以上几种数据结构都有各自的特点和应用场景，那么他们之间的区别和关系是怎么样的呢？以及在Java语言当中是如何实现的呢？

## 数组(Array)
##### 所谓数组，是有序的元素序列。若将有限个类型相同的变量的集合命名，那么这个名称为数组名。组成数组的各个变量称为数组的分量，也称为数组的元素，有时也称为下标变量。用于区分数组的各个元素的数字编号称为下标。数组是在程序设计中，为了处理方便， 把具有相同类型的若干元素按无序的形式组织起来的一种形式。这些无序排列的同类数据元素的集合称为数组。

##### 数组是用于储存多个相同类型数据的集合。该数据类型比较基础简单，这里不做过多的解释和介绍。

![array](/img/note/jdk/array.jpg)<div class='img-note'>数组结构图</div>

### java当中的数组

#### 一、数组声明
##### 数组的声明有两种方式：
```java
//一维数组
type arrayName[];
type[] arrayName;
//多维数组
type arrayName[][];
type[][] arrayName;
```

#### 二、数组初始化
##### 方式一：
```java
//分配长度为 4 个 int 型的内存空间，并分别赋初始值1，2，3，4
int[] array = new int[]{1, 2, 3, 4};
//多维数组
int [][] array = new int[][]{{1,2}, {3,4}};
```
##### 方式二：
```java
//方式一的简写
int[] array = {1, 2, 3, 4};
//多维数组
int [][] array = {{1,2}, {3,4}};
//非均匀数组，array[1][0] = 3, 但是array[1][0]会报指针溢出异常（ArrayIndexOutOfBoundsException）
int [][] array = {{1,2}, {3}};
```
##### 方式三：
```java
//分配长度为 4 的内存空间，并全部赋为默认值 0
//相当于 int[] array = new int[4]{0, 0, 0, 0} 的简写
int[] array = new int[4];
//多维数组
int [][] array = new int[2][2];
```
#### 需要注意的是：
1. 数组的创建必须申明数组长度，这是因为在jvm中分配内存的时候，数组的内存块是连续的，这样的内存结构能够保证数组的下标访问时间复杂度是O(1)，这也是数组和链表的最大区别。
2. 对于返回值类型为数组类型的函数来说，我们可以return new int[3];，我们也可以return new int[]{1, 2, 3};，但我们不可以return {1, 2, 3};。即方式二仅是方式一的简写，其不能脱离数组的声明，{1, 2, 3}并不能返回一个数组对象。

## 链表(Linked List)
##### 链表是一种物理存储单元上非连续、非顺序的存储结构，数据元素的逻辑顺序是通过链表中的指针链接次序实现的。链表由一系列结点（链表中每一个元素称为结点）组成，结点可以在运行时动态生成。每个结点包括两个部分：一个是存储数据元素的数据域，另一个是存储下一个结点地址的指针域。 相比于线性表顺序结构，操作复杂。由于不必须按顺序存储，链表在插入的时候可以达到O(1)的复杂度，比另一种线性表顺序表快得多，但是查找一个节点或者访问特定编号的节点则需要O(n)的时间，而线性表和顺序表相应的时间复杂度分别是O(logn)和O(1)。
![list](/img/note/jdk/list.png)<div class='img-note'>链表</div>

### java当中的链表
##### 在List集合中，我们常用到ArrayList和LinkedList这两个类：
![list](/img/note/jdk/javaList.png)<div class='img-note'>Java List类继承关系</div>

#### List常用方法：
```java
//添加功能
boolean add(E e):向集合中添加一个元素
void add(int index, E element):在指定位置添加元素
boolean addAll(Collection<? extends E> c)：向集合中添加一个集合的元素。

//删除功能
void clear()：删除集合中的所有元素
E remove(int index)：根据指定索引删除元素，并把删除的元素返回
boolean remove(Object o)：从集合中删除指定的元素
boolean removeAll(Collection<?> c):从集合中删除一个指定的集合元素。

//修改功能
E set(int index, E element):把指定索引位置的元素修改为指定的值，返回修改前的值。

//获取功能
E get(int index)：获取指定位置的元素
Iterator iterator():就是用来获取集合中每一个元素。

//判断功能
boolean isEmpty()：判断集合是否为空。
boolean contains(Object o)：判断集合中是否存在指定的元素。
boolean containsAll(Collection<?> c)：判断集合中是否存在指定的一个集合中的元素。

//长度功能
int size():获取集合中的元素个数

//把集合转换成数组
Object[] toArray():把集合变成数组。
```

#### List集合相对于数组Array来说，主要有以下区别：
* 动态扩容：容量不固定，随着容量的增加而动态扩容
* 有序集合（插入的顺序==输出的顺序）
* 插入的元素可以为null

### ArrayList和LinkedList比较
##### 两种list的区别主要在于他们之间的底层数据结构不同，ArrayList使用数组作为基础数据结构，LinkedList使用链表最为基础数据结构。因此他们之间的差别，也主要体现在两种数据结构之上。

#### 元素新增
##### ArrayList底层是数组实现，在数组的基础结构之上进行了封装，实现了List最重要的特点之一：动态扩容。因为数组有固定长度，所以当元素数量超过数组长度时，ArrayList需要重新申请新的数组对象（容量翻倍），然后将原数组数据copy至新申请的数组中，之后再进行插入操作。
![ArrayInsert](/img/note/jdk/ArrayInsert.png)
##### LinkedList使用指针进行元素关联，不存在连续内存分配和数组扩容机制。新增元素时只需要分配新元素的内存空间，然后和原最后节点进行指针关联。

#### 元素删除
##### ArrayList在删除除最后元素之外，需要将该元素之后的所有数据往前位移一位。
##### LinkedList只需要将删除节点前的节点重新指向删除后的节点。

##### 在元素增加和元素删除的操作逻辑上来看，ArrayList相比LinkedList更加复杂。但是因为JDK近几年的更新发展，对于数组复制的实现进行了优化，以至于ArrayList的性能也得到了提高。

#### 元素获取
##### ArrayList因为内存连续，各个数据存在相应的下标，因此随机访问只需要计算内存偏移量，然后直接访问，因此时间复杂度为O(1);
##### LinkedList为链表结构，随机访问需要从头元素进行遍历访问，因此事件复杂度为O(n);

## 散列表(Hash)
##### 散列表（Hash table，也叫哈希表），是根据关键码值(Key value)而直接进行访问的数据结构。也就是说，它通过把关键码值映射到表中一个位置来访问记录，以加快查找的速度。这个映射函数叫做散列函数，存放记录的数组叫做散列表。

![hash](/img/note/jdk/hash.png)

### Java当中的散列表

![javaMap](/img/note/jdk/JavaMap.png)<div class='img-note'>Java Map类继承关系</div>

#### Map常用方法：
```java
//添加功能
V put(K key, V value):向Map中添加一个键值对，并返回该value
void putAll(Map<? extends K, ? extends V> m)：向Map中添加一系列元素。

//删除功能
void clear()：删除Map中的所有元素
V remove(Object key)：从Map中删除指定的元素

//修改功能
boolean replace(K key, V oldValue, V newValue):如果oldValue和原来的值相同，替换成新值

//获取功能
V get(Object key)：根据Key获取对应value
Set<K> keySet()：返回key集合
Collection<V> values()：返回value集合
Set<Map.Entry<K, V>> entrySet()：获取键值对集合

//判断功能
boolean isEmpty()：判断Map是否为空。
boolean containsKey(Object key)：判断Map中是否存在指定的Key元素。
boolean containsValue(Object value)：判断Map中是否存在指定的Value元素。

//长度功能
int size():获取Map中的元素个数

```
### HashTable、HashMap和TreeMap比较

#### 数据结构

* HashTable：采用数组+单向链表的方式实现
* HashMap：在Java6中HashMap中采用table数组+链表的方式来实现（Java8中采用数组+链表+红黑树）。
* TreeMap：基于红黑树的NavigableMap实现

#### 并发访问安全
* HashTable采用synchronized关键字保证线程安全，因此对map的操作都会导致整个对象的锁定，锁的粒度相对于ConcurrentHashMap来说会大一些。
* HashMap和TreeMap则不保证线程安全
