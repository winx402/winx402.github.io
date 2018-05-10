---
layout: post
title: 大量订单的去重计算-BloomFilter
date: 2018/05/08
tags: [tech, arithmetic, index]
original: true
tag: [[算法, arithmetic]]
---

##### 如果需要对数据进行去重，我们最先想到一定是集合set，以及数据库的唯一索引。如果数据有持久化的需求，数据库的唯一索引是一个比较好的解决办法，因为这样你可以做分布式处理并且保证最终的一致性。如果数据不需要持久存储，只需要在内存当中去处理重复数据，则我们通常会使用set集合做处理。但是如果数据量特别大呢？我们如何处理
<!-- more -->

##### 最近的遇到的需求场景如下。我们有大量的用户打车订单数据，需要将订单和企业地理位置做挂钩。按照企业位置的一定半径范围统计订单情况，那么离得比较近的公司在一定范围内的很多订单都是重复的，为了不对这部分订单做重复处理，并且订单信息也不做数据库存储。我们需要在每次任务计算的时候对订单做是否重复判断。
##### 目前的订单数据量大约在千万级别（只计算很小部分城市），能够预测到的未来将有数10亿的订单量。如果按照订单id做去重，订单的id为long类型，占用8个字节64bit。则订单号在内存中的占用量大约为：
1. 1000w数据量
<pre><code class="hljs"><h6>8byte * 10<sup>7</sup> = 1byte * 1024 * 1024 * 76.29 = 76.29MB
</h6></code></pre>
2. 10亿数据量
<pre><code class="hljs"><h6>76.29MB * 100 = 7.45GB
</h6></code></pre>

##### 可以看到，在数10亿的情况下内存占用已经达到7.5GB左右，虽然该占用量不是不能接受，但还是有优化空间的。那就是布隆过滤器（BloomFilter）。

## BitMap
##### 在介绍布隆过滤器之前，首先介绍BitMap，因为布隆过滤器的思路和原理就是通过BitMap转换过来的。
##### 对于一个整型数，比如int a = 1 在java内存中占32bit位，这是为了方便计算机的运算。但是对于某些应用场景而言，这属于一种巨大的浪费。比如我们判断这个数是否存在，我们真的需要把这个数用int类型完整的保留下来吗？答案当然是不需要，我们只需要用一个bit位去记录，0-未出现，1-出现。因此我们可以用对应的32bit位对应存储十进制的0-31，而这就是Bit-map的基本思想。Bit-map算法利用这种思想处理大量数据的排序、查询以及去重。

### BitMap应用之快速去重

##### 2.5亿个整数中找出不重复的整数的个数，内存空间不足以容纳这2.5亿个整数。 
##### 首先，根据“内存空间不足以容纳这2.5亿个整数”我们可以快速的联想到Bit-map。下边关键的问题就是怎么设计我们的Bit-map来表示这2.5亿个数字的状态了。其实这个问题很简单，一个数字的状态只有两种，分别为不存在，存在。因此，我们只需要1bit就可以对一个数字的状态进行存储了，我们设定一个数字不存在为0，存在一次1。那我们大概需要存储空间几十兆左右。
##### 接下来的任务就是遍历一次这2.5亿个数字，判断对应下标的bit位，如果为0则表示之前没有出现过，并且将该位设置为1。如果为1则表示之前已经出现过，为重复数据，则可以丢弃。
#### 优点：
* 占用内存少 
* 运算效率高

#### 缺点：
* 对于非连续数据，有可能中间会有大量的bit位没有使用，导致部分空间浪费
* 对于不是从0开始的数据，需要找到一种映射关系，将已有的数据表示为从0开始的数据。比如原始数据是从100000为起点的整数，如果使用bitmap，将导致前面的100000个bit位没有使用上。最简单的办法是我们可以将原始数据做减100000的映射表示。

### BitMap应用之快速排序
##### 假设我们要对0-7内的5个元素(4,7,2,5,3)排序（这里假设这些元素没有重复）,我们就可以采用Bit-map的方法来达到排序的目的。要表示8个数，我们就只需要8个Bit（1Bytes），将这些空间的所有Bit位都置为0。
<table><tr>
<td>0</td>
<td>0</td>
<td>0</td>
<td>0</td>
<td>0</td>
<td>0</td>
<td>0</td>
<td>0</td>
</tr></table>

##### 将元素(4,7,2,5,3)对应下标位设置为1:
<table><tr>
<td>0</td>
<td>0</td>
<td>1</td>
<td>1</td>
<td>1</td>
<td>1</td>
<td>0</td>
<td>1</td>
</tr></table>

##### 遍历一遍Bit区域，将该位是一的位的编号输出（2，3，4，5，7），这样就达到了排序的目的，时间复杂度O(n)。
#### 优点：
* 运算效率高，不需要进行比较和移位；
* 占用内存少，比如N=10000000；只需占用内存为N/8=1250000Byte=1.25M。 

#### 缺点：
* 所有的数据不能重复。即不可对重复的数据进行排序和查找。

### JAVA当中的BitMap
##### 在JAVA当中，BitMap的实现为BitSet类，使用long类型数组来表示所有的bit位，数组当中的一个long字段可以表示64位：
```java
/**
 * The number of words in the logical size of this BitSet.
 */
private long[] words;
```

##### 具体的BitSet使用和原理，可以参考以下文章：
1. [Java Bitset类 | 菜鸟教程](http://www.runoob.com/java/java-bitset-class.html)
2. [Java BitSet](https://blog.csdn.net/top_code/article/details/40583279)

## BloomFilter
##### 了解了BitMap的实现和原理之后，我们会发现如下的缺点：
1. 通过单调hash计算后的整型值最好是相对连续的
2. 对于很多数据（如url），很难找到某种hash算法能够平滑的映射到BitMap上。换句话来说就是hash碰撞的概率很高。

##### 因此我们引入另一个著名的工业实现——布隆过滤器（Bloom Filter）。如果说Bitmap对于每一个可能的整型值，通过直接寻址的方式进行映射，相当于使用了一个哈希函数，那布隆过滤器就是引入了k(k>1)个相互独立的哈希函数，保证在给定的空间、误判率下，完成元素判重的过程。下图中是k=3时的布隆过滤器。
![k=3的bloomfilter](/img/arithmetic/bloomfilter.png)

##### 当一个元素被加入集合中时,通过k各散列函数将这个元素映射成一个位数组中的k个点,并将这k个点全部置为1.
##### 有一定的误判率--在判断一个元素是否属于某个集合时,有可能会把不属于这个集合的元素误判为属于这个集合.因此,它不适合那些"零误判"的应用场合.在能容忍低误判的应用场景下,布隆过滤器通过极少的误判换区了存储空间的极大节省。
#### 优点：
1. 相比于其它的数据结构，布隆过滤器在空间和时间方面都有巨大的优势。布隆过滤器存储空间和插入/查询时间都是常数（O(k)）。另外, 散列函数相互之间没有关系，方便由硬件并行实现。布隆过滤器不需要存储元素本身，在某些对保密要求非常严格的场合有优势。
2. k和m相同，使用同一组散列函数的两个布隆过滤器的交并差运算可以使用位操作进行。

#### 缺点：
1. 误算率。随着存入的元素数量增加，误算率随之增加。但是如果元素数量太少，则使用散列表足矣。
2. 一般情况下不能从布隆过滤器中删除元素. 我们很容易想到把位数组变成整数数组，每插入一个元素相应的计数器加1, 这样删除元素时将计数器减掉就可以了。然而要保证安全地删除元素并非如此简单。首先我们必须保证删除的元素的确在布隆过滤器里面. 这一点单凭这个过滤器是无法保证的。另外计数器回绕也会造成问题。

### guava中的BloomFilter实现
```java
public static <T> BloomFilter<T> create(Funnel<? super T> funnel, int expectedInsertions, double fpp) {
    return create(funnel, expectedInsertions, fpp, DEFAULT_STRATEGY);
}
```
* expectedInsertions：预估数据量
* fpp：误判率

##### 正确估计预期插入数量是很关键的一个参数。当插入的数量接近或高于预期值的时候，布隆过滤器将会填满，这样的话，它会产生很多无用的误报点。

#### 测试：
```java
public class BloomFilterTest {
    //目标数据量
    private static int count = 10000000;
    //BloomFilter
    private static BloomFilter bloomFilter = BloomFilter.create(Funnels.integerFunnel(), count, 0.01);
    //BloomFilter判断出来的重复数据量
    private static int bloomFilterRepeatCount = 0;
    //Set集合
    private static Set<Integer> set = Sets.newHashSetWithExpectedSize(count);
    //Set集合判断出来的重复量
    private static int repeatCount = 0;

    public static void main(String[] args) {
        Random random = new Random();
        for (int i = 0; i < count; i++) {
            int i1 = random.nextInt(count);
            bloomFilter(i1);
            setFilter(i1);
            if (i % 10000 == 0){
                System.out.println(i / 10000 + "万");
            }
        }
        System.out.println("bloom filter : " + bloomFilterRepeatCount);
        System.out.println("set filter : " + repeatCount);
    }

    private static void bloomFilter(int i) {
        if (bloomFilter.mightContain(i)) {
            bloomFilterRepeatCount++;
        } else {
            bloomFilter.put(i);
        }
    }

    private static void setFilter(int i) {
        if (!set.add(i)) repeatCount++;
    }
}
```

##### 设置1000w的数据集，BloomFilter的fpp设置为0.01，输出结果：
```
bloom filter : 3679750
set filter : 3678908
```

##### 可以看到效果还是挺好的，可能和int数据类型有关，如果换成url类型。误判结果应该会更高一些。
#### 代码地址：[BloomFilterTest](https://github.com/winx402/Java/blob/master/src/main/java/com/winx/arithmetic/BloomFilterTest.java)