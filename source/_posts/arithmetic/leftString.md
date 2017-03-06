---
layout: post
title: 左旋转字符串
date: 2017/03/06
tags: [arithmetic, index]
---

## 题目要求：
##### 定义字符串的左旋转操作：把字符串前面的若干个字符移动到字符串的尾部。
##### 如把字符串abcdef左旋转2位得到字符串cdefab。请实现字符串左旋转的函数。
##### 要求时间对长度为n的字符串操作的复杂度为O(n)，辅助内存为O(1)。
<!--more-->

## 分析过程：
#####  题目要求很简单，其实就是字符串的位置交换，一个长度为n的字符串，将字符串的前面m个字符的子串和后面的字符进行位置交换。如果用普通的java代码进行编写的话，会非常简单

```JAVA
String result = start.substring(m,n) + start.substring(0, m);
```

##### java对数组的复制使用System.arraycopy的本地方法， 以这种方式实现的话，时间复杂度是符合O(n)要求的，但是空间复杂度却要大于O(1)。这明显是不符合题意的。
##### 首先，能够想到的是，字符串的左旋转，其实就是对字符数组的左旋转。既然是对数组的位置交换，则数组的每个位置的字符在交换之后的位置是已经确定的，并且能够找到一定的规律的。比如题目中的例子，把字符串abcdef左旋转2位得到字符串cdefab；
##### 假设字符串的数组为arry,字符串的长度为6（n=6），左旋转2位（m=2），则数组中每一位的位置相应的转换为
###### a:array[0] -> array[0+4] -> array[4]
###### b:array[1] -> array[1+4] -> array[5]
###### c:array[2] -> array[2-2] -> array[0]
###### d:array[3] -> array[3-2] -> array[1]
###### e:array[4] -> array[4-2] -> array[2]
###### f:array[5] -> array[5-2] -> array[3]
##### 可以看出，字符位置的交换是很有规律的，对于字符长度为n，左旋m位的数组
1. 前面m个字符，左旋后的位置为i+(n-m)
2. 后面n-m个字符，左旋后的位置为j-m

#### 基于这套交换逻辑，想要实现如下算法，却发现不符合题目要求：
##### 1. 初始字符串为abcdef，左旋转2位得到字符串cdefab

|&nbsp;a&nbsp;|&nbsp;b&nbsp;|&nbsp;c&nbsp;|&nbsp;d&nbsp;|&nbsp;e&nbsp;|&nbsp;f&nbsp;|
|-|-|-|-|-|-|

##### 2. 将array[0]写入到到array[4]， 用tmp记录array[4]

|&nbsp;a&nbsp;|&nbsp;b&nbsp;|&nbsp;c&nbsp;|&nbsp;d&nbsp;|&nbsp;a&nbsp;|&nbsp;f&nbsp;|
|-|-|-|-|-|-|
　　　tmp = e

##### 3. 将array[4]写入到到array[2]， 用tmp记录array[2]

|&nbsp;a&nbsp;|&nbsp;b&nbsp;|&nbsp;e&nbsp;|&nbsp;d&nbsp;|&nbsp;a&nbsp;|&nbsp;f&nbsp;|
|-|-|-|-|-|-|
　　　tmp = c

##### 4. 将array[2]写入到到array[0]， 用tmp记录array[0]

|&nbsp;c&nbsp;|&nbsp;b&nbsp;|&nbsp;e&nbsp;|&nbsp;d&nbsp;|&nbsp;a&nbsp;|&nbsp;f&nbsp;|
|-|-|-|-|-|-|
　　　tmp = a

##### 问题就出在第四步，回到起点后，继续交换显然是错误的，这就需要额外的空间去记录那些位置是已经交换的，并且需要的额外空间随着原始字符串长度的增加而线性增长，所以这种方式的空间负责度为O(n),不符合O(1)的要求。

#### 于是想到的另外一种解题方式，依次将数组元素与之后的第m位交换：
##### 1. 初始字符串为abcdef，

|&nbsp;a&nbsp;|&nbsp;b&nbsp;|&nbsp;c&nbsp;|&nbsp;d&nbsp;|&nbsp;e&nbsp;|&nbsp;f&nbsp;|
|-|-|-|-|-|-|

##### 2. 将array[0]与array[2]交换

|&nbsp;<font color='red'>c</font>&nbsp;|&nbsp;b&nbsp;|&nbsp;<font color='red'>a</font>&nbsp;|&nbsp;d&nbsp;|&nbsp;e&nbsp;|&nbsp;f&nbsp;|
|-|-|-|-|-|-|

##### 3.  将array[1]与array[3]交换

|&nbsp;c&nbsp;|&nbsp;<font color='red'>d</font>&nbsp;|&nbsp;a&nbsp;|&nbsp;<font color='red'>b</font>&nbsp;|&nbsp;e&nbsp;|&nbsp;f&nbsp;|
|-|-|-|-|-|-|

##### 4. 将array[2]与array[4]交换

|&nbsp;c&nbsp;|&nbsp;d&nbsp;|&nbsp;<font color='red'>e</font>&nbsp;|&nbsp;b&nbsp;|&nbsp;<font color='red'>a</font>&nbsp;|&nbsp;f&nbsp;|
|-|-|-|-|-|-|

##### 5. 将array[3]与array[5]交换

|&nbsp;c&nbsp;|&nbsp;d&nbsp;|&nbsp;e&nbsp;|&nbsp;<font color='red'>f</font>&nbsp;|&nbsp;a&nbsp;|&nbsp;<font color='red'>b</font>&nbsp;|
|-|-|-|-|-|-|

##### 这种实现方式需要进行n-m次交换，时间复杂度为O(n),需要两个额外空间，分别是交换数组元素的tmp指针，和记录当前交换位置的指针，这也符合常数空间复杂度O(1)。

## 解题：
##### 看了网络上的一些其他解法，也比较巧妙
##### 字符串abcdef，我们想移动ab到cdef之后，我们可以将ab做对称反转变成ba，cdef变成fedc，整个字符串变成bafedc,反向读取则为cdefab
```C++
public static String[] exchange(String[] s,int from,int to){

        while(from<to){
            String temp = s[from];
            s[from++] = s[to];
            s[to--] = temp;

        }
        return s;
    }
```

##### 调用3次此方法即可左旋字符串

## 最后再说一些：
##### 对于时间复杂度和空间复杂度的计算，需要去低阶项，去掉常数项，去掉高阶项，T(n)=(2n<sup>2</sup>+n+1)=O(n<sup>2</sup>);若执行时间是一个与问题规模n无关的常数，算法的时间复杂度为常数阶，记作T(n)=O(1)。
