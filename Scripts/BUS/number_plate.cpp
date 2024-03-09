#include<iostream>
#include<fstream>
#include<unordered_map>
#include<cstdlib>
using namespace std;

ofstream out("number_plate.txt");

int main(){
    unordered_map<int,int> map;
    for(int i=1;i<=92;i++){
        int rand1 = rand()%90+10;
        int rand2 = rand()%90+10;
        int rand3 = rand()%90+10;
        long total=rand1*10000+rand2*100+rand3;
        if(map.find(total)!=map.end()){
            continue;
        }
        map[total]=i;
        out<<"UPDATE BUS SET LICENSE_PLATE='DHAKA METRO BA-"<<rand1<<"-"<<rand2<<rand3<<"' WHERE BUS_ID="<<i<<";"<<endl;
    }
}