#include<iostream>
#include<fstream>
#include<cstdlib>
using namespace std;

ofstream out("./BUS.TXT");

int main(){
    string types[3]={"Sleeper Coach","AC Bus","Non-AC Bus"};
    for(int i=1;i<=46;i++){
        for(int j=1;j<=2;j++){
            int route=rand()%8+1;
            int schedule=rand()%5+1;
            int type=rand()%3;
            double ticket_price;
            switch(type){
                case 0: ticket_price=(rand()%10+51); break;
                case 1: ticket_price=(rand()%10+31); break;
                case 2: ticket_price=(rand()%10+11); break;
            }
            ticket_price/=10;
            int seat_count=rand()%3+6;
            int stars=((rand()%10+1)+40);
            double rating=(double)stars/10;
            out<<"INSERT INTO BUS VALUES(SEQ_BUS.NEXTVAL,"<<i<<","<<route<<","<<schedule<<",'"<<types[type]<<"',"<<seat_count*5<<","<<rating<<","<<ticket_price<<");"<<endl;
        }
    }
}