import java.io.*;
import java.text.DecimalFormat;
import java.util.*;

public class script {
    public static void main(String[] args) throws Exception {
        BufferedReader good_review = new BufferedReader(new FileReader("./good_review.txt"));
        BufferedReader bad_review = new BufferedReader(new FileReader("./bad_review.txt"));
        BufferedReader neutral_review = new BufferedReader(new FileReader("./neutral_review.txt"));
        FileWriter fw = new FileWriter("./review_script.txt");
        BufferedWriter bw = new BufferedWriter(fw);
        int REVIEW_COUNT=1000;
        int USER_COUNT=4000;
        int BUS_COUNT=92;
        Random random = new Random();
        String [][] reviews=new String[3][];
        reviews[0]=new String[100];
        reviews[1]=new String[100];
        reviews[2]=new String[100];
        Boolean[][] reviewwd=new Boolean[USER_COUNT][BUS_COUNT];
        for(int i=0;i<USER_COUNT;i++){
            for(int j=0;j<BUS_COUNT;j++){
                reviewwd[i][j]=false;
            }
        }
        int good_review_count=0;
        int bad_review_count=0;
        int neutral_review_count=0;
        while(true){
            String s=good_review.readLine();
            if(s==null)
                break; 
            reviews[0][good_review_count++]=s;
        }
        while(true){
            String s=bad_review.readLine();
            if(s==null)
                break; 
            reviews[1][bad_review_count++]=s;
        }
        while(true){
            String s=neutral_review.readLine();
            if(s==null)
                break; 
            reviews[2][neutral_review_count++]=s;
        }
        for(String[] s:reviews){
            for(String str:s){
                if(str==null){
                    break;
                }
                System.out.println(str);
            }
        }
        for(String[] s:reviews){
            for(int i=0;i<s.length;i++){
                if(s[i]==null){
                    break;
                }
                String str1=s[i].replaceAll("'","''");
                s[i]=str1;
            }
        }
        for(int i=0;i<REVIEW_COUNT;i++){
            int review_type=random.nextInt(3);
            DecimalFormat df = new DecimalFormat("#.#");
            switch(review_type){
                case 0:{
                    int index=random.nextInt(good_review_count);
                    int score=random.nextInt(2)+4;
                    int user_id=random.nextInt(USER_COUNT)+1;
                    int bus_id=random.nextInt(92)+1;
                    while(reviewwd[user_id-1][bus_id-1]!=false){
                        user_id=random.nextInt(USER_COUNT)+1;
                        bus_id=random.nextInt(92)+1;
                    }
                    reviewwd[user_id-1][bus_id-1]=true;
                    String insertStatement="INSERT INTO REVIEW VALUES("+user_id+","+bus_id+","+score+",'"+reviews[review_type][index]+"');";
                    bw.write(insertStatement);
                    bw.newLine();
                    break;
                }
                case 1:{
                    int index=random.nextInt(bad_review_count);
                    int score=random.nextInt(3)+1;
                    int user_id=random.nextInt(USER_COUNT)+1;
                    int bus_id=random.nextInt(BUS_COUNT)+1;
                    while(reviewwd[user_id-1][bus_id-1]!=false){
                        user_id=random.nextInt(USER_COUNT)+1;
                        bus_id=random.nextInt(92)+1;
                    }
                    reviewwd[user_id-1][bus_id-1]=true;
                    String insertStatement="INSERT INTO REVIEW VALUES("+user_id+","+bus_id+","+score+",'"+reviews[review_type][index]+"');";
                    bw.write(insertStatement);
                    bw.newLine();
                    break;
                }
                case 2:{
                    int index=random.nextInt(neutral_review_count);
                    int score=random.nextInt(2)+3;
                    int user_id=random.nextInt(USER_COUNT)+1;
                    int bus_id=random.nextInt(BUS_COUNT)+1;
                    while(reviewwd[user_id-1][bus_id-1]!=false){
                        user_id=random.nextInt(USER_COUNT)+1;
                        bus_id=random.nextInt(92)+1;
                    }
                    reviewwd[user_id-1][bus_id-1]=true;
                    String insertStatement="INSERT INTO REVIEW VALUES("+user_id+","+bus_id+","+score+",'"+reviews[review_type][index]+"');";
                    bw.write(insertStatement);
                    bw.newLine();
                    break;
                }
            }
        }
        bw.close();
        fw.close();
        good_review.close();
        bad_review.close(); 
        neutral_review.close();
    }
}
